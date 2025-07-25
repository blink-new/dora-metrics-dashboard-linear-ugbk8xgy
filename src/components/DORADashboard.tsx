import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Settings, Download, RefreshCw, CheckCircle, XCircle, Activity, Shield, BookOpen } from 'lucide-react';
import { blink } from '../blink/client';

import MetricCard from './MetricCard';
import LeadTimeAnalysis from './LeadTimeAnalysis';
import EstimationAnalysis from './EstimationAnalysis';
import CodeReviewAnalysis from './CodeReviewAnalysis';
import CycleDataExplorer from './CycleDataExplorer';
import ReadmePage from './ReadmePage';
import TrendAnalysis from './TrendAnalysis';

import LinearApiClient, { LinearIssue, LinearCycle, generateStatusHistory } from '@/lib/linearApi';
import DORACalculator, { DORAMetrics, LeadTimeAnalysis as LeadTimeAnalysisType, EstimationAnalysis as EstimationAnalysisType, CodeReviewAnalysis as CodeReviewAnalysisType } from '@/lib/doraCalculator';
import { sampleIssues, sampleTeams } from '@/lib/sampleData';
import { dataStorage } from '@/lib/dataStorage';
import { historicalDataManager } from '@/lib/historicalDataManager';
import { cycleDataManager } from '@/lib/cycleDataManager';

const DORADashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [teams, setTeams] = useState<Array<{ id: string; name: string; key: string }>>([]);
  const [selectedCycle, setSelectedCycle] = useState('all');
  const [cycles, setCycles] = useState<LinearCycle[]>([]);
  const [period, setPeriod] = useState('30');
  
  // Debug period changes
  useEffect(() => {
    console.log('🔍 Period changed to:', period);
  }, [period]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [doraMetrics, setDoraMetrics] = useState<DORAMetrics | null>(null);
  const [leadTimeAnalysis, setLeadTimeAnalysis] = useState<LeadTimeAnalysisType | null>(null);
  const [estimationAnalysis, setEstimationAnalysis] = useState<EstimationAnalysisType | null>(null);
  const [codeReviewAnalysis, setCodeReviewAnalysis] = useState<CodeReviewAnalysisType | null>(null);

  const [linearClient, setLinearClient] = useState<LinearApiClient | null>(null);

  // Configuration cache to prevent excessive database calls
  const [configCache, setConfigCache] = useState<any>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Cache management state
  const [cacheInfo, setCacheInfo] = useState<{
    hasCache: boolean;
    cachedAt?: string;
    issueCount?: number;
  }>({ hasCache: false });
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  // Rate limit handling with exponential backoff
  const handleRateLimit = useCallback(async (retryFn: () => Promise<any>, retryCount: number = 0): Promise<any> => {
    if (retryCount >= 3) {
      console.warn('Max retry attempts reached for database operation');
      setIsRateLimited(false);
      return null;
    }

    try {
      const result = await retryFn();
      setIsRateLimited(false);
      return result;
    } catch (err: any) {
      if (err?.status === 429 || err?.code === 'RATE_LIMIT_EXCEEDED') {
        setIsRateLimited(true);
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return handleRateLimit(retryFn, retryCount + 1);
      }
      throw err;
    }
  }, []);

  // Local storage helpers for offline config
  const saveConfigToLocalStorage = useCallback((config: any) => {
    try {
      localStorage.setItem(`dora_config_${user?.id}`, JSON.stringify(config));
    } catch (err) {
      console.warn('Failed to save config to localStorage:', err);
    }
  }, [user?.id]);

  const loadConfigFromLocalStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(`dora_config_${user?.id}`);
      return stored ? JSON.parse(stored) : null;
    } catch (err) {
      console.warn('Failed to load config from localStorage:', err);
      return null;
    }
  }, [user?.id]);

  // Simple debounce utility
  const debounce = useCallback((func: (...args: any[]) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }, []);

  // Debounced config save to prevent rate limiting
  const debouncedSaveConfig = useMemo(
    () => debounce(async (config: any, userId: string) => {
      return handleRateLimit(async () => {
        const dbConfig = {
          linear_api_key: config.linear_api_key,
          selected_team: config.selected_team,
          selected_cycle: config.selected_cycle,
          period: config.period,
          updated_at: new Date().toISOString()
        };

        const existingConfigs = await blink.db.userConfigs.list({
          where: { user_id: userId },
          limit: 1
        });
        
        if (existingConfigs.length > 0) {
          await blink.db.userConfigs.update(existingConfigs[0].id, dbConfig);
        } else {
          await blink.db.userConfigs.create({
            id: `config_${userId}`,
            user_id: userId,
            ...dbConfig,
            created_at: new Date().toISOString()
          });
        }
      });
    }, 3000), // 3 second debounce for config saves
    [debounce, handleRateLimit]
  );

  // Database helper functions with caching and rate limit handling
  const saveUserConfig = useCallback(async (config: {
    linear_api_key?: string;
    selected_team?: string;
    selected_cycle?: string;
    period?: string;
  }) => {
    if (!user?.id) return;
    
    // Update cache immediately for responsive UI
    const updatedConfig = { ...configCache, ...config };
    setConfigCache(updatedConfig);
    saveConfigToLocalStorage(updatedConfig);
    
    // Use debounced database save to prevent rate limiting
    debouncedSaveConfig(updatedConfig, user.id);
  }, [user?.id, configCache, saveConfigToLocalStorage, debouncedSaveConfig]);

  const loadUserConfig = useCallback(async () => {
    if (!user?.id) return null;
    
    // Return cached config if available
    if (configLoaded && configCache) {
      return configCache;
    }
    
    // Try local storage first
    const localConfig = loadConfigFromLocalStorage();
    if (localConfig && !configLoaded) {
      setConfigCache(localConfig);
      setConfigLoaded(true);
      return localConfig;
    }
    
    // Load from database with rate limit handling
    return handleRateLimit(async () => {
      const configs = await blink.db.userConfigs.list({
        where: { user_id: user.id },
        limit: 1
      });
      
      const config = configs.length > 0 ? configs[0] : null;
      setConfigCache(config);
      setConfigLoaded(true);
      
      if (config) {
        saveConfigToLocalStorage(config);
      }
      
      return config;
    });
  }, [user?.id, configLoaded, configCache, handleRateLimit, loadConfigFromLocalStorage, saveConfigToLocalStorage]);

  // Debounced save function to prevent rate limiting
  const debouncedSaveMetrics = useMemo(
    () => debounce(async (teamId: string, cycleId: string, period: string, metrics: any, issues: any, userId: string) => {
      try {
        const cacheId = `cache_${userId}_${teamId}_${cycleId}_${period}`;
        
        const existingCache = await blink.db.userMetrics.list({
          where: { 
            user_id: userId,
            team_id: teamId === 'all' ? null : teamId,
            cycle_id: cycleId === 'all' ? null : cycleId,
            period
          },
          limit: 1
        });
        
        const cacheData = {
          user_id: userId,
          team_id: teamId === 'all' ? null : teamId,
          cycle_id: cycleId === 'all' ? null : cycleId,
          period,
          metrics_data: JSON.stringify(metrics),
          issues_data: JSON.stringify(issues),
          updated_at: new Date().toISOString()
        };
        
        if (existingCache.length > 0) {
          await blink.db.userMetrics.update(existingCache[0].id, cacheData);
        } else {
          await blink.db.userMetrics.create({
            id: cacheId,
            ...cacheData,
            created_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Error saving metrics cache:', err);
        // Don't throw - just log the error to prevent UI crashes
      }
    }, 5000), // 5 second debounce for metrics
    [debounce]
  );

  const saveMetricsCache = useCallback(async (teamId: string, cycleId: string, period: string, metrics: any, issues: any) => {
    if (!user?.id) return;
    debouncedSaveMetrics(teamId, cycleId, period, metrics, issues, user.id);
  }, [user?.id, debouncedSaveMetrics]);

  // Check cache and load data accordingly
  const checkCacheAndLoadData = useCallback(async (teamId?: string, cycleId?: string) => {
    const teamToUse = teamId || selectedTeam;
    const cycleToUse = cycleId || selectedCycle;
    
    if (!user?.id) return;

    setIsLoading(true);
    setError('');
    setShowUpdatePrompt(false);

    try {
      // Check if data exists in cache
      const teamIdForCache = teamToUse === 'all' ? null : teamToUse;
      const cycleIdForCache = cycleToUse === 'all' ? null : cycleToUse;
      
      console.log('🔍 SIMPLIFIED CACHE CHECK - Looking for any cached data...');
      console.log('🔍 Parameters:', { userId: user.id, teamId: teamIdForCache, cycleId: cycleIdForCache });
      
      // SIMPLIFIED APPROACH - look for ANY cached data for this team/cycle combination
      const cacheEntries = await blink.db.cycle_data_cache.list({
        where: {
          user_id: user.id,
          team_id: teamIdForCache,
          cycle_id: cycleIdForCache
        },
        orderBy: { cached_at: 'desc' },
        limit: 1
      });

      console.log('🔍 Cache query result:', {
        foundEntries: cacheEntries.length,
        entryId: cacheEntries[0]?.id,
        period: cacheEntries[0]?.period,
        cachedAt: cacheEntries[0]?.cached_at
      });

      if (cacheEntries.length > 0) {
        const cacheEntry = cacheEntries[0];
        
        console.log('📦 FOUND CACHED DATA - Parsing...');
        console.log('📦 Raw cache entry keys:', Object.keys(cacheEntry));
        console.log('📦 Issues data length (snake_case):', cacheEntry.issues_data?.length || 0);
        console.log('📦 Issues data length (camelCase):', cacheEntry.issuesData?.length || 0);
        console.log('📦 Metrics data length (snake_case):', cacheEntry.metrics_data?.length || 0);
        console.log('📦 Metrics data length (camelCase):', cacheEntry.metricsData?.length || 0);
        
        // Parse and validate data - try both field name formats
        let parsedIssues = [];
        let parsedMetrics = {};
        
        try {
          // Parse issues data - try both field name formats
          const issuesDataField = cacheEntry.issuesData || cacheEntry.issues_data;
          if (issuesDataField && issuesDataField.trim() !== '') {
            parsedIssues = JSON.parse(issuesDataField);
            console.log('✅ Issues parsed successfully:', parsedIssues.length, 'issues');
          } else {
            console.log('⚠️ Empty issues data');
          }
          
          // Parse metrics data - try both field name formats
          const metricsDataField = cacheEntry.metricsData || cacheEntry.metrics_data;
          if (metricsDataField && metricsDataField.trim() !== '') {
            parsedMetrics = JSON.parse(metricsDataField);
            console.log('✅ Metrics parsed successfully:', Object.keys(parsedMetrics));
            
            // Migrate old cached data that doesn't have timeToDeploy metric
            if (parsedMetrics.doraMetrics && !parsedMetrics.doraMetrics.timeToDeploy) {
              console.log('🔄 Migrating old cached data - adding missing timeToDeploy metric');
              parsedMetrics.doraMetrics.timeToDeploy = {
                value: 0,
                unit: 'business days',
                formattedValue: '0 hours',
                trend: 0,
                rating: 'Low',
                details: {
                  totalDeployments: 0,
                  averageDeployTime: 0,
                  deploymentDescription: 'No deployment data available in cached metrics'
                }
              };
            }
          } else {
            console.log('⚠️ Empty metrics data');
          }
          
        } catch (parseError) {
          console.error('❌ JSON parsing error:', parseError);
          console.log('📦 Issues data preview:', cacheEntry.issues_data?.substring(0, 100));
          console.log('📦 Metrics data preview:', cacheEntry.metrics_data?.substring(0, 100));
          throw new Error(`Failed to parse cached data: ${parseError.message}`);
        }
        
        // Validate parsed data
        if (!Array.isArray(parsedIssues)) {
          console.error('❌ Issues data is not an array:', typeof parsedIssues);
          parsedIssues = [];
        }
        
        if (typeof parsedMetrics !== 'object' || parsedMetrics === null) {
          console.error('❌ Metrics data is not an object:', typeof parsedMetrics);
          parsedMetrics = {};
        }
        
        console.log('🔄 FORCING React state updates...');
        
        // FORCE React state updates with explicit logging
        console.log('✅ setIssues called with', parsedIssues.length, 'issues');
        setIssues(parsedIssues);
        
        console.log('✅ setDoraMetrics called with data');
        setDoraMetrics(parsedMetrics.doraMetrics || null);
        
        console.log('✅ setLeadTimeAnalysis called with data');
        setLeadTimeAnalysis(parsedMetrics.leadTimeAnalysis || null);
        
        console.log('✅ setEstimationAnalysis called with data');
        setEstimationAnalysis(parsedMetrics.estimationAnalysis || null);
        
        console.log('✅ setCodeReviewAnalysis called with data');
        setCodeReviewAnalysis(parsedMetrics.codeReviewAnalysis || null);
        
        // Update cache info
        setCacheInfo({
          hasCache: true,
          cachedAt: cacheEntry.cached_at,
          issueCount: parsedIssues.length
        });
        
        // Verify state updates after a short delay
        setTimeout(() => {
          console.log('🔍 VERIFICATION - Current React state after 100ms:');
          console.log('- Issues length:', parsedIssues.length);
          console.log('- DoraMetrics exists:', !!parsedMetrics.doraMetrics);
          console.log('- LeadTimeAnalysis exists:', !!parsedMetrics.leadTimeAnalysis);
          console.log('- EstimationAnalysis exists:', !!parsedMetrics.estimationAnalysis);
          console.log('- CodeReviewAnalysis exists:', !!parsedMetrics.codeReviewAnalysis);
        }, 100);
        
        console.log('🎉 CACHE LOAD COMPLETE:', parsedIssues.length, 'issues loaded from cache');
        
      } else {
        // No cache - show update prompt
        console.log('💾 No cached data found. Showing update prompt.');
        setShowUpdatePrompt(true);
        setCacheInfo({ hasCache: false });
        
        // Clear any existing data to show empty state
        setIssues([]);
        setDoraMetrics(null);
        setLeadTimeAnalysis(null);
        setEstimationAnalysis(null);
        setCodeReviewAnalysis(null);
      }
    } catch (err) {
      console.error('❌ Error in cache load:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cached data');
      setShowUpdatePrompt(true);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, selectedTeam, selectedCycle]);

  // Load data from Linear API and save to cache
  const loadDataFromLinear = useCallback(async (client?: LinearApiClient, teamId?: string, cycleId?: string) => {
    const clientToUse = client || linearClient;
    const teamToUse = teamId || selectedTeam;
    const cycleToUse = cycleId || selectedCycle;
    
    if (!clientToUse || !user?.id) return;

    setIsLoading(true);
    setError('');

    try {
      console.log('🔄 Loading data from Linear API...');
      
      const teamIdToUse = teamToUse === 'all' ? undefined : teamToUse || undefined;
      const cycleIdToUse = cycleToUse === 'all' ? undefined : cycleToUse || undefined;
      const issuesData = await clientToUse.getIssuesWithHistory(teamIdToUse, cycleIdToUse, parseInt(period));
      
      if (!Array.isArray(issuesData)) {
        throw new Error('Invalid data received from Linear API');
      }
      
      console.log(`📥 Loaded ${issuesData.length} issues from Linear API`);
      
      setIssues(issuesData);

      // Save issues to historical database for comprehensive analysis
      if (Array.isArray(issuesData) && issuesData.length > 0) {
        try {
          console.log(`Saving ${issuesData.length} issues to historical database...`);
          await historicalDataManager.saveIssuesHistory(user.id, issuesData);
          console.log('✅ Issues saved to historical database successfully');
        } catch (histError: any) {
          console.error('❌ Failed to save issues to historical database:', histError);
          
          // Provide specific error feedback based on error type
          if (histError?.status === 409 || histError?.message?.includes('UNIQUE constraint failed')) {
            console.warn('⚠️ Some duplicate issues were skipped during historical data save');
          } else if (histError?.status === 429 || histError?.code === 'RATE_LIMIT_EXCEEDED' || histError?.message?.includes('Rate limit exceeded')) {
            console.warn('⚠️ Rate limit reached during historical data save. The system will automatically retry with smart backoff.');
            setError('Data loaded successfully. Historical data saving is rate limited but will continue in the background with automatic retries.');
          } else {
            console.warn('⚠️ Historical data save encountered errors, continuing with calculations...');
          }
          
          // Continue with calculations using current data
          console.log('Continuing with DORA calculations using current data...');
        }
      }

      // Calculate metrics with historical data for confidence intervals
      const selectedCycleInfo = cycleToUse !== 'all' && cycles.length > 0 
        ? cycles.find(c => c.id === cycleToUse) 
        : undefined;
      const calculator = new DORACalculator(issuesData, selectedCycleInfo, cycles, user.id);
      
      // Load historical data for comprehensive confidence intervals
      await calculator.loadHistoricalData();
      
      const metrics = calculator.calculateDORAMetrics();
      const leadTime = calculator.calculateLeadTimeAnalysis();
      const estimation = calculator.calculateEstimationAnalysis();
      const codeReview = calculator.calculateCodeReviewAnalysis();

      setDoraMetrics(metrics);
      setLeadTimeAnalysis(leadTime);
      setEstimationAnalysis(estimation);
      setCodeReviewAnalysis(codeReview);

      // Save to cache
      const teamIdForCache = teamToUse === 'all' ? null : teamToUse;
      const cycleIdForCache = cycleToUse === 'all' ? null : cycleToUse;
      
      await cycleDataManager.saveToCache(
        user.id,
        teamIdForCache,
        cycleIdForCache,
        period,
        issuesData,
        {
          doraMetrics: metrics,
          leadTimeAnalysis: leadTime,
          estimationAnalysis: estimation,
          codeReviewAnalysis: codeReview
        }
      );

      // Update cache info
      const newCacheInfo = await cycleDataManager.getCacheInfo(
        user.id,
        teamIdForCache,
        cycleIdForCache,
        period
      );
      setCacheInfo(newCacheInfo);
      setShowUpdatePrompt(false);

      // Also save as a snapshot for trend analysis
      try {
        console.log('Saving snapshot for trend analysis...');
        const snapshotId = await dataStorage.saveSnapshot(
          user.id,
          teamIdForCache,
          cycleIdForCache,
          period,
          issuesData,
          {
            doraMetrics: metrics,
            leadTimeAnalysis: leadTime,
            estimationAnalysis: estimation,
            codeReviewAnalysis: codeReview
          }
        );
        console.log('Snapshot saved successfully:', snapshotId);
      } catch (snapshotError) {
        console.error('Failed to save snapshot for trend analysis:', snapshotError);
        // Show user feedback about snapshot saving failure
        setError(`Data loaded successfully, but failed to save snapshot for trend analysis: ${snapshotError instanceof Error ? snapshotError.message : 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error loading data from Linear:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data from Linear API');
    } finally {
      setIsLoading(false);
    }
  }, [linearClient, selectedTeam, selectedCycle, period, cycles, user?.id]);

  const testConnection = useCallback(async (client?: LinearApiClient) => {
    const clientToUse = client || linearClient;
    if (!clientToUse) return;

    setIsLoading(true);
    setError('');

    try {
      const connected = await clientToUse.testConnection();
      setIsConnected(connected);
      
      if (connected) {
        const teamsData = await clientToUse.getTeams();
        setTeams(teamsData);
        
        // Load cycles for the selected team
        const cyclesData = await clientToUse.getCycles(selectedTeam === 'all' ? undefined : selectedTeam);
        // Ensure no duplicates
        const uniqueCyclesData = cyclesData.filter((cycle, index, self) => 
          self.findIndex(c => c.id === cycle.id) === index
        );
        setCycles(uniqueCyclesData);
        
        // Set the most recent cycle as default if we have cycles and no cycle is selected
        if (uniqueCyclesData.length > 0 && selectedCycle === 'all') {
          const mostRecentCycle = uniqueCyclesData[0]; // Already sorted by most recent first
          setSelectedCycle(mostRecentCycle.id);
        }
      } else {
        setError('Failed to connect to Linear API. Please check your API key.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [linearClient, selectedTeam, selectedCycle]);

  // Load user authentication state
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  // Load saved configuration from database (optimized to prevent multiple calls)
  useEffect(() => {
    if (!user?.id || configLoaded) return;

    let isMounted = true;

    const loadUserData = async () => {
      try {
        const config = await loadUserConfig();
        if (!config || !isMounted) return;

        const savedApiKey = config.linear_api_key;
        const savedTeam = config.selected_team;
        const savedPeriod = config.period || '30';
        
        if (savedApiKey) {
          setApiKey(savedApiKey);
          const client = new LinearApiClient({ apiKey: savedApiKey });
          setLinearClient(client);
          
          if (savedTeam && savedTeam.trim() !== '') {
            setSelectedTeam(savedTeam);
          }
          
          if (savedPeriod) {
            setPeriod(savedPeriod);
          }
          
          // Auto-connect if we have saved credentials
          try {
            const connected = await client.testConnection();
            if (!isMounted) return;
            
            setIsConnected(connected);
            
            if (connected) {
              const teamsData = await client.getTeams();
              if (!isMounted) return;
              setTeams(teamsData);
              
              // Load cycles for the saved team
              const teamIdToUse = savedTeam === 'all' ? undefined : savedTeam;
              const cyclesData = await client.getCycles(teamIdToUse);
              if (!isMounted) return;
              // Ensure no duplicates
              const uniqueCyclesData = cyclesData.filter((cycle, index, self) => 
                self.findIndex(c => c.id === cycle.id) === index
              );
              setCycles(uniqueCyclesData);
              
              // Set the most recent cycle as default if we have cycles
              let cycleToSelect = 'all';
              if (uniqueCyclesData.length > 0) {
                const mostRecentCycle = uniqueCyclesData[0];
                cycleToSelect = mostRecentCycle.id;
                setSelectedCycle(cycleToSelect);
              }
              
              // Check cache and load data immediately
              if (savedTeam && isMounted) {
                await checkCacheAndLoadData(savedTeam, cycleToSelect);
              }
            }
          } catch (err) {
            if (isMounted) {
              console.error('Error auto-connecting:', err);
              setError(err instanceof Error ? err.message : 'Failed to connect');
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error loading user data:', err);
          setError(err instanceof Error ? err.message : 'Failed to load configuration');
        }
      }
    };
    
    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [user?.id, configLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Linear API key');
      return;
    }

    const client = new LinearApiClient({ apiKey: apiKey.trim() });
    setLinearClient(client);
    
    // Save API key to database
    await saveUserConfig({ linear_api_key: apiKey.trim() });
    
    await testConnection(client);
  };

  const handleTeamChange = async (teamId: string) => {
    if (!teamId || teamId.trim() === '') {
      return;
    }
    setSelectedTeam(teamId);
    
    if (isConnected && linearClient) {
      // Load cycles for the new team
      try {
        const cyclesData = await linearClient.getCycles(teamId === 'all' ? undefined : teamId);
        // Ensure no duplicates at the component level as well
        const uniqueCyclesData = cyclesData.filter((cycle, index, self) => 
          self.findIndex(c => c.id === cycle.id) === index
        );
        setCycles(uniqueCyclesData);
        
        // Set the most recent cycle as default if we have cycles
        let cycleToSelect = 'all';
        if (uniqueCyclesData.length > 0) {
          const mostRecentCycle = uniqueCyclesData[0]; // Already sorted by most recent first
          cycleToSelect = mostRecentCycle.id;
        }
        setSelectedCycle(cycleToSelect);
        
        // Check cache and load data with the selected cycle
        checkCacheAndLoadData(teamId, cycleToSelect);
        
        // Save user configuration
        await saveUserConfig({
          selected_team: teamId,
          selected_cycle: cycleToSelect
        });
      } catch (err) {
        console.error('Error loading cycles:', err);
        setSelectedCycle('all');
        checkCacheAndLoadData(teamId, 'all');
      }
    }
  };

  const handleCycleChange = (cycleId: string) => {
    if (!cycleId || cycleId.trim() === '') {
      return;
    }
    setSelectedCycle(cycleId);
    if (isConnected && linearClient) {
      checkCacheAndLoadData(selectedTeam, cycleId);
      
      // Save user configuration
      saveUserConfig({
        selected_cycle: cycleId
      });
    }
  };

  const handlePeriodChange = (newPeriod: string) => {
    if (!newPeriod || newPeriod.trim() === '') {
      return;
    }
    setPeriod(newPeriod);
    if (isConnected && linearClient) {
      checkCacheAndLoadData();
      
      // Save user configuration
      saveUserConfig({
        period: newPeriod
      });
    }
  };

  const handleRefresh = () => {
    if (isConnected && linearClient) {
      loadDataFromLinear();
    }
  };

  const exportData = (format: 'csv' | 'pdf') => {
    // TODO: Implement export functionality
    console.log(`Exporting data as ${format}`);
  };

  const loadDemoData = () => {
    setIsDemoMode(true);
    setIsConnected(true);
    setTeams(sampleTeams);
    setSelectedTeam('all');
    
    // Apply status history generation to sample issues at runtime
    const issuesWithHistory = sampleIssues.map(issue => generateStatusHistory(issue));
    setIssues(issuesWithHistory);

    // Calculate metrics with sample data (no specific cycle for demo)
    const calculator = new DORACalculator(issuesWithHistory, undefined, []);
    const metrics = calculator.calculateDORAMetrics();
    const leadTime = calculator.calculateLeadTimeAnalysis();
    const estimation = calculator.calculateEstimationAnalysis();
    const codeReview = calculator.calculateCodeReviewAnalysis();

    setDoraMetrics(metrics);
    setLeadTimeAnalysis(leadTime);
    setEstimationAnalysis(estimation);
    setCodeReviewAnalysis(codeReview);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Activity className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                DORA Metrics Dashboard
              </h1>
              {isConnected && (
                <Badge className={isDemoMode ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {isDemoMode ? 'Demo Mode' : 'Connected'}
                </Badge>
              )}
              {user && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Shield className="h-3 w-3 mr-1" />
                  Protected Data
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {isConnected && (
                <>
                  <Select value={period} onValueChange={handlePeriodChange}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportData('csv')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        Documentation
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>DORA Metrics Documentation</DialogTitle>
                      </DialogHeader>
                      <ReadmePage />
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuration Panel */}
        {!isConnected && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Linear API Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="apiKey">Linear API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your Linear API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Get your API key from Linear Settings → API → Personal API Keys. 
                  Make sure to copy the full key starting with "lin_api_".
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={handleConnect} 
                  disabled={isLoading || !apiKey.trim()}
                  className="flex-1 sm:flex-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect to Linear'
                  )}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={loadDemoData}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none"
                >
                  Try Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team and Cycle Selection */}
        {isConnected && teams.length > 0 && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:items-center">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="team">Team:</Label>
                  <Select value={selectedTeam} onValueChange={handleTeamChange}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All teams</SelectItem>
                      {teams.filter(team => team.id && team.id.trim() !== '').map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name} ({team.key})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Label htmlFor="cycle">Cycle:</Label>
                  <Select value={selectedCycle} onValueChange={handleCycleChange}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select a cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All cycles</SelectItem>
                      {cycles
                        .filter((cycle, index, self) => 
                          // Remove duplicates by id
                          self.findIndex(c => c.id === cycle.id) === index
                        )
                        .map((cycle) => (
                          <SelectItem key={`cycle-${cycle.id}`} value={cycle.id}>
                            {cycle.name} (#{cycle.number})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="text-sm text-gray-500">
                  {issues.length} issues loaded
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cache Status and Update Prompt */}
        {isConnected && user && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:items-center sm:justify-between">
                <div className="flex items-center space-x-4">
                  {cacheInfo.hasCache ? (
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Cached Data
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {cacheInfo.issueCount} issues cached at {new Date(cacheInfo.cachedAt!).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                        <XCircle className="h-3 w-3 mr-1" />
                        No Cache
                      </Badge>
                      <span className="text-sm text-gray-600">
                        No cached data for this selection
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {showUpdatePrompt && (
                    <Alert className="border-blue-200 bg-blue-50 p-3 mr-4">
                      <AlertDescription className="text-blue-800 text-sm">
                        No cached data found. Click "Update Data" to load from Linear API.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button
                    onClick={() => loadDataFromLinear()}
                    disabled={isLoading}
                    variant={showUpdatePrompt ? "default" : "outline"}
                    size="sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {showUpdatePrompt ? 'Loading...' : 'Updating...'}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {showUpdatePrompt ? 'Update Data' : 'Refresh Data'}
                      </>
                    )}
                  </Button>
                  
                  {cacheInfo.hasCache && (
                    <Button
                      onClick={async () => {
                        const teamIdForCache = selectedTeam === 'all' ? null : selectedTeam;
                        const cycleIdForCache = selectedCycle === 'all' ? null : selectedCycle;
                        await cycleDataManager.clearCache(user.id, teamIdForCache, cycleIdForCache, period);
                        await checkCacheAndLoadData();
                      }}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Clear Cache
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rate Limit Alert */}
        {isRateLimited && (
          <Alert className="mb-8 border-yellow-200 bg-yellow-50">
            <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
            <AlertDescription className="text-yellow-800">
              Database rate limit reached. Automatically retrying with smart backoff...
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert className="mb-8 border-red-200 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        {isConnected && doraMetrics && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="leadtime">Cycle Time</TabsTrigger>
              <TabsTrigger value="estimation">Estimation</TabsTrigger>
              <TabsTrigger value="codereview">Code Review</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="explorer">Data Explorer</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* DORA Metrics Cards - First Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                <MetricCard
                  title="Deployment Frequency"
                  value={doraMetrics.deploymentFrequency.value}
                  unit={doraMetrics.deploymentFrequency.unit}
                  displayText={doraMetrics.deploymentFrequency.displayText}
                  trend={doraMetrics.deploymentFrequency.trend}
                  rating={doraMetrics.deploymentFrequency.rating}
                  description="How often your team deploys code to production"
                  metricKey="deploymentFrequency"
                />
                <MetricCard
                  title="Lead Time for Changes"
                  value={doraMetrics.leadTimeForChanges.value}
                  unit={doraMetrics.leadTimeForChanges.unit}
                  formattedValue={doraMetrics.leadTimeForChanges.formattedValue}
                  trend={doraMetrics.leadTimeForChanges.trend}
                  rating={doraMetrics.leadTimeForChanges.rating}
                  description="Time from code committed to code successfully running in production"
                  metricKey="leadTimeForChanges"
                />
                {codeReviewAnalysis && (
                  <MetricCard
                    title="Average Time in Code Review"
                    value={codeReviewAnalysis.averageTimeInReview.value}
                    unit={codeReviewAnalysis.averageTimeInReview.unit}
                    formattedValue={codeReviewAnalysis.averageTimeInReview.formattedValue}
                    trend={codeReviewAnalysis.averageTimeInReview.trend}
                    rating={codeReviewAnalysis.averageTimeInReview.rating}
                    description="Average time from code review start to merge"
                    metricKey="codeReviewTime"
                  />
                )}
                <MetricCard
                  title="Time to Deploy"
                  value={doraMetrics.timeToDeploy?.value || 0}
                  unit={doraMetrics.timeToDeploy?.unit || 'business days'}
                  formattedValue={doraMetrics.timeToDeploy?.formattedValue}
                  trend={doraMetrics.timeToDeploy?.trend || 0}
                  rating={doraMetrics.timeToDeploy?.rating || 'Low'}
                  description="Time from code merged to deployed in production"
                  details={doraMetrics.timeToDeploy?.details}
                  metricKey="timeToDeploy"
                />
              </div>

              {/* DORA Metrics Cards - Second Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <MetricCard
                  title="Change Failure Rate"
                  value={doraMetrics.changeFailureRate.value}
                  unit={doraMetrics.changeFailureRate.unit}
                  trend={doraMetrics.changeFailureRate.trend}
                  rating={doraMetrics.changeFailureRate.rating}
                  description="Percentage of deployed tasks that resulted in failures"
                  details={doraMetrics.changeFailureRate.details}
                  metricKey="changeFailureRate"
                />
                <MetricCard
                  title="Time to Recovery"
                  value={doraMetrics.timeToRecovery.value}
                  unit={doraMetrics.timeToRecovery.unit}
                  formattedValue={doraMetrics.timeToRecovery.formattedValue}
                  trend={doraMetrics.timeToRecovery.trend}
                  rating={doraMetrics.timeToRecovery.rating}
                  description="Time to recover from a failure in production"
                  metricKey="timeToRecovery"
                />
              </div>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{issues.length}</div>
                      <div className="text-sm text-gray-600">Total Issues</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {issues.filter(i => i.completedAt).length}
                      </div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {issues.filter(i => !i.completedAt).length}
                      </div>
                      <div className="text-sm text-gray-600">In Progress</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(issues.filter(i => i.estimate).reduce((sum, i) => sum + (i.estimate || 0), 0))}
                      </div>
                      <div className="text-sm text-gray-600">Total Points</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leadtime">
              {leadTimeAnalysis && <LeadTimeAnalysis data={leadTimeAnalysis} />}
            </TabsContent>

            <TabsContent value="estimation">
              {estimationAnalysis && <EstimationAnalysis data={estimationAnalysis} />}
            </TabsContent>

            <TabsContent value="codereview">
              {codeReviewAnalysis && <CodeReviewAnalysis data={codeReviewAnalysis} />}
            </TabsContent>

            <TabsContent value="trends">
              {user && (
                <TrendAnalysis
                  userId={user.id}
                  teamId={selectedTeam === 'all' ? null : selectedTeam}
                  cycleId={selectedCycle === 'all' ? null : selectedCycle}
                  period={period}
                />
              )}
            </TabsContent>

            <TabsContent value="explorer">
              <CycleDataExplorer 
                issues={issues}
                selectedCycle={selectedCycle !== 'all' ? cycles.find(c => c.id === selectedCycle) : undefined}
                cycles={cycles}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Loading State */}
        {isLoading && isConnected && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading data...</span>
          </div>
        )}

        {/* Empty State */}
        {isConnected && !isLoading && issues.length === 0 && !error && (
          <Card>
            <CardContent className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
              <p className="text-gray-500">
                No issues found for the selected team and time period. 
                Try selecting a different team or extending the time range.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DORADashboard;