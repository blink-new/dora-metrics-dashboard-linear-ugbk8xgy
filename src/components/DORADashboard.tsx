import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, Download, RefreshCw, CheckCircle, XCircle, Activity } from 'lucide-react';

import MetricCard from './MetricCard';
import LeadTimeAnalysis from './LeadTimeAnalysis';
import EstimationAnalysis from './EstimationAnalysis';
import CodeReviewAnalysis from './CodeReviewAnalysis';

import LinearApiClient, { LinearIssue, LinearCycle } from '@/lib/linearApi';
import DORACalculator, { DORAMetrics, LeadTimeAnalysis as LeadTimeAnalysisType, EstimationAnalysis as EstimationAnalysisType, CodeReviewAnalysis as CodeReviewAnalysisType } from '@/lib/doraCalculator';
import { sampleIssues, sampleTeams } from '@/lib/sampleData';

const DORADashboard = () => {
  const [apiKey, setApiKey] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [teams, setTeams] = useState<Array<{ id: string; name: string; key: string }>>([]);
  const [selectedCycle, setSelectedCycle] = useState('all');
  const [cycles, setCycles] = useState<LinearCycle[]>([]);
  const [period, setPeriod] = useState('30');
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

  const loadData = useCallback(async (client?: LinearApiClient, teamId?: string, cycleId?: string) => {
    const clientToUse = client || linearClient;
    const teamToUse = teamId || selectedTeam;
    const cycleToUse = cycleId || selectedCycle;
    
    if (!clientToUse) return;

    setIsLoading(true);
    setError('');

    try {
      const teamIdToUse = teamToUse === 'all' ? undefined : teamToUse || undefined;
      const cycleIdToUse = cycleToUse === 'all' ? undefined : cycleToUse || undefined;
      const issuesData = await clientToUse.getIssuesWithHistory(teamIdToUse, cycleIdToUse, parseInt(period));
      
      if (!Array.isArray(issuesData)) {
        throw new Error('Invalid data received from Linear API');
      }
      
      setIssues(issuesData);

      // Calculate metrics
      const selectedCycleInfo = cycleToUse !== 'all' && cycles.length > 0 
        ? cycles.find(c => c.id === cycleToUse) 
        : undefined;
      const calculator = new DORACalculator(issuesData, selectedCycleInfo);
      const metrics = calculator.calculateDORAMetrics();
      const leadTime = calculator.calculateLeadTimeAnalysis();
      const estimation = calculator.calculateEstimationAnalysis();
      const codeReview = calculator.calculateCodeReviewAnalysis();

      setDoraMetrics(metrics);
      setLeadTimeAnalysis(leadTime);
      setEstimationAnalysis(estimation);
      setCodeReviewAnalysis(codeReview);

      // Save selected team
      if (teamToUse) {
        localStorage.setItem('linear_team_id', teamToUse);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [linearClient, selectedTeam, selectedCycle, period, cycles]);

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
        setCycles(cyclesData);
        
        // Set the most recent cycle as default if we have cycles and no cycle is selected
        if (cyclesData.length > 0 && selectedCycle === 'all') {
          const mostRecentCycle = cyclesData[0]; // Already sorted by most recent first
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



  // Load saved configuration
  useEffect(() => {
    const savedApiKey = localStorage.getItem('linear_api_key');
    const savedTeam = localStorage.getItem('linear_team_id');
    
    if (savedApiKey) {
      setApiKey(savedApiKey);
      const client = new LinearApiClient({ apiKey: savedApiKey });
      setLinearClient(client);
      
      if (savedTeam && savedTeam.trim() !== '') {
        setSelectedTeam(savedTeam);
      }
      
      // Auto-connect if we have saved credentials
      const connectAndLoad = async () => {
        setIsLoading(true);
        setError('');

        try {
          const connected = await client.testConnection();
          setIsConnected(connected);
          
          if (connected) {
            const teamsData = await client.getTeams();
            setTeams(teamsData);
            
            // Load cycles for the saved team
            try {
              const teamIdToUse = savedTeam === 'all' ? undefined : savedTeam;
              const cyclesData = await client.getCycles(teamIdToUse);
              setCycles(cyclesData);
              
              // Set the most recent cycle as default if we have cycles
              let cycleToSelect = 'all';
              if (cyclesData.length > 0) {
                const mostRecentCycle = cyclesData[0]; // Already sorted by most recent first
                cycleToSelect = mostRecentCycle.id;
                setSelectedCycle(cycleToSelect);
              }
              
              // If we have a saved team, load data immediately
              if (savedTeam) {
                try {
                  const cycleIdToUse = cycleToSelect === 'all' ? undefined : cycleToSelect;
                  const issuesData = await client.getIssuesWithHistory(teamIdToUse, cycleIdToUse, parseInt(period));
                  
                  if (!Array.isArray(issuesData)) {
                    throw new Error('Invalid data received from Linear API');
                  }
                  
                  setIssues(issuesData);

                  // Calculate metrics
                  const selectedCycleInfo = cycleToSelect !== 'all' && cyclesData.length > 0 
                    ? cyclesData.find(c => c.id === cycleToSelect) 
                    : undefined;
                  const calculator = new DORACalculator(issuesData, selectedCycleInfo);
                  const metrics = calculator.calculateDORAMetrics();
                  const leadTime = calculator.calculateLeadTimeAnalysis();
                  const estimation = calculator.calculateEstimationAnalysis();
                  const codeReview = calculator.calculateCodeReviewAnalysis();

                  setDoraMetrics(metrics);
                  setLeadTimeAnalysis(leadTime);
                  setEstimationAnalysis(estimation);
                  setCodeReviewAnalysis(codeReview);

                  // Save selected team
                  localStorage.setItem('linear_team_id', savedTeam);
                } catch (dataErr) {
                  console.error('Error loading saved team data:', dataErr);
                  setError(dataErr instanceof Error ? dataErr.message : 'Failed to load data');
                }
              }
            } catch (cycleErr) {
              console.error('Error loading cycles:', cycleErr);
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
      };
      
      connectAndLoad();
    }
  }, [period]); // Only depend on period

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Linear API key');
      return;
    }

    const client = new LinearApiClient({ apiKey: apiKey.trim() });
    setLinearClient(client);
    
    // Save API key
    localStorage.setItem('linear_api_key', apiKey.trim());
    
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
        setCycles(cyclesData);
        
        // Set the most recent cycle as default if we have cycles
        let cycleToSelect = 'all';
        if (cyclesData.length > 0) {
          const mostRecentCycle = cyclesData[0]; // Already sorted by most recent first
          cycleToSelect = mostRecentCycle.id;
        }
        setSelectedCycle(cycleToSelect);
        
        // Load data with the selected cycle
        loadData(linearClient, teamId, cycleToSelect);
      } catch (err) {
        console.error('Error loading cycles:', err);
        setSelectedCycle('all');
        loadData(linearClient, teamId, 'all');
      }
    }
  };

  const handleCycleChange = (cycleId: string) => {
    if (!cycleId || cycleId.trim() === '') {
      return;
    }
    setSelectedCycle(cycleId);
    if (isConnected && linearClient) {
      loadData(linearClient, selectedTeam, cycleId);
    }
  };

  const handlePeriodChange = (newPeriod: string) => {
    if (!newPeriod || newPeriod.trim() === '') {
      return;
    }
    setPeriod(newPeriod);
    if (isConnected && linearClient) {
      loadData();
    }
  };

  const handleRefresh = () => {
    if (isConnected && linearClient) {
      loadData();
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
    setIssues(sampleIssues);

    // Calculate metrics with sample data (no specific cycle for demo)
    const calculator = new DORACalculator(sampleIssues);
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
                      {cycles.map((cycle) => (
                        <SelectItem key={cycle.id} value={cycle.id}>
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="leadtime">Lead Time</TabsTrigger>
              <TabsTrigger value="estimation">Estimation</TabsTrigger>
              <TabsTrigger value="codereview">Code Review</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* DORA Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  title="Deployment Frequency"
                  value={doraMetrics.deploymentFrequency.value}
                  unit={doraMetrics.deploymentFrequency.unit}
                  displayText={doraMetrics.deploymentFrequency.displayText}
                  trend={doraMetrics.deploymentFrequency.trend}
                  rating={doraMetrics.deploymentFrequency.rating}
                  description="How often your team deploys code to production"
                />
                <MetricCard
                  title="Lead Time for Changes"
                  value={doraMetrics.leadTimeForChanges.value}
                  unit={doraMetrics.leadTimeForChanges.unit}
                  formattedValue={doraMetrics.leadTimeForChanges.formattedValue}
                  trend={doraMetrics.leadTimeForChanges.trend}
                  rating={doraMetrics.leadTimeForChanges.rating}
                  description="Time from code committed to code successfully running in production"
                />
                <MetricCard
                  title="Change Failure Rate"
                  value={doraMetrics.changeFailureRate.value}
                  unit={doraMetrics.changeFailureRate.unit}
                  trend={doraMetrics.changeFailureRate.trend}
                  rating={doraMetrics.changeFailureRate.rating}
                  description="Percentage of deployments causing a failure in production"
                />
                <MetricCard
                  title="Time to Recovery"
                  value={doraMetrics.timeToRecovery.value}
                  unit={doraMetrics.timeToRecovery.unit}
                  formattedValue={doraMetrics.timeToRecovery.formattedValue}
                  trend={doraMetrics.timeToRecovery.trend}
                  rating={doraMetrics.timeToRecovery.rating}
                  description="Time to recover from a failure in production"
                />
              </div>

              {/* Code Review Metric */}
              {codeReviewAnalysis && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <MetricCard
                    title="Average Time in Code Review"
                    value={codeReviewAnalysis.averageTimeInReview.value}
                    unit={codeReviewAnalysis.averageTimeInReview.unit}
                    formattedValue={codeReviewAnalysis.averageTimeInReview.formattedValue}
                    trend={codeReviewAnalysis.averageTimeInReview.trend}
                    rating={codeReviewAnalysis.averageTimeInReview.rating}
                    description="Average time from code review start to merge"
                  />
                  <div className="md:col-span-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold">Code Review Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{codeReviewAnalysis.tasks.length}</div>
                            <div className="text-sm text-gray-600">Total Reviews</div>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">
                              {codeReviewAnalysis.distribution.find(d => d.range === '< 4 hours')?.percentage || 0}%
                            </div>
                            <div className="text-sm text-gray-600">Same Day</div>
                          </div>
                          <div className="text-center p-4 bg-red-50 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">
                              {codeReviewAnalysis.distribution.find(d => d.range === '> 1 week')?.percentage || 0}%
                            </div>
                            <div className="text-sm text-gray-600">Over 1 Week</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

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