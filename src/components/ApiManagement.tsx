import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  Zap, 
  Database, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Settings,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { dataStorage } from '@/lib/dataStorage';

interface ApiManagementProps {
  userId: string;
  onConfigChange?: (config: ApiConfig) => void;
}

interface ApiConfig {
  refreshIntervalMinutes: number;
  maxCacheAge: number;
  enableAutoRefresh: boolean;
  enableSmartCaching: boolean;
  apiCallLimit: number;
}

interface ApiUsageStats {
  totalCalls: number;
  cachedResponses: number;
  lastRefresh: string | null;
  cacheHitRate: number;
  estimatedSavings: number;
}

const ApiManagement: React.FC<ApiManagementProps> = ({ userId, onConfigChange }) => {
  const [config, setConfig] = useState<ApiConfig>({
    refreshIntervalMinutes: 60,
    maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
    enableAutoRefresh: true,
    enableSmartCaching: true,
    apiCallLimit: 100
  });

  const [usageStats, setUsageStats] = useState<ApiUsageStats>({
    totalCalls: 0,
    cachedResponses: 0,
    lastRefresh: null,
    cacheHitRate: 0,
    estimatedSavings: 0
  });

  const [isLoading, setIsLoading] = useState(false);

  const loadConfig = async () => {
    try {
      // Load from localStorage or use defaults
      const savedConfig = localStorage.getItem(`api_config_${userId}`);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        onConfigChange?.(parsed);
      }
    } catch (error) {
      console.warn('Failed to load API config:', error);
    }
  };

  const saveConfig = async (newConfig: ApiConfig) => {
    try {
      localStorage.setItem(`api_config_${userId}`, JSON.stringify(newConfig));
      setConfig(newConfig);
      onConfigChange?.(newConfig);
    } catch (error) {
      console.warn('Failed to save API config:', error);
    }
  };

  const loadUsageStats = async () => {
    try {
      // Simulate API usage stats - in a real app, this would come from your backend
      const stats = {
        totalCalls: Math.floor(Math.random() * 50) + 10,
        cachedResponses: Math.floor(Math.random() * 30) + 5,
        lastRefresh: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        cacheHitRate: 0,
        estimatedSavings: 0
      };
      
      stats.cacheHitRate = stats.totalCalls > 0 ? (stats.cachedResponses / stats.totalCalls) * 100 : 0;
      stats.estimatedSavings = stats.cachedResponses * 0.1; // Assume $0.10 per API call saved
      
      setUsageStats(stats);
    } catch (error) {
      console.warn('Failed to load usage stats:', error);
    }
  };

  useEffect(() => {
    loadConfig();
    loadUsageStats();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfigChange = (key: keyof ApiConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    saveConfig(newConfig);
  };

  const clearCache = async () => {
    setIsLoading(true);
    try {
      await dataStorage.cleanupOldSnapshots(userId, 0); // Clear all cache
      await loadUsageStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshNow = async () => {
    setIsLoading(true);
    try {
      // Trigger a manual refresh - this would call your data loading function
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      await loadUsageStats();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRefreshIntervalText = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours`;
    return `${Math.floor(minutes / 1440)} days`;
  };

  const getCacheAgeText = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${Math.floor(hours)} hours`;
    return `${Math.floor(hours / 24)} days`;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return 'text-green-600';
    if (percentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUsageBadgeColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-100 text-green-800';
    if (percentage < 80) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const usagePercentage = (usageStats.totalCalls / config.apiCallLimit) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">API Management</h2>
        <p className="text-gray-600">Control API usage and optimize performance with smart caching</p>
      </div>

      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">API Calls Today</p>
                <p className={`text-2xl font-bold ${getUsageColor(usagePercentage)}`}>
                  {usageStats.totalCalls}
                </p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <Badge className={getUsageBadgeColor(usagePercentage)}>
                {Math.round(usagePercentage)}% of limit
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cache Hit Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {Math.round(usageStats.cacheHitRate)}%
                </p>
              </div>
              <Database className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <Badge className="bg-green-100 text-green-800">
                {usageStats.cachedResponses} cached
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Estimated Savings</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${usageStats.estimatedSavings.toFixed(2)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2">
              <Badge className="bg-purple-100 text-purple-800">
                This month
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Last Refresh</p>
                <p className="text-sm font-medium text-gray-900">
                  {usageStats.lastRefresh 
                    ? new Date(usageStats.lastRefresh).toLocaleTimeString()
                    : 'Never'
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-gray-500" />
            </div>
            <div className="mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={refreshNow}
                disabled={isLoading}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cache Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-refresh">Enable Auto Refresh</Label>
                <Switch
                  id="auto-refresh"
                  checked={config.enableAutoRefresh}
                  onCheckedChange={(checked) => handleConfigChange('enableAutoRefresh', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="smart-caching">Smart Caching</Label>
                <Switch
                  id="smart-caching"
                  checked={config.enableSmartCaching}
                  onCheckedChange={(checked) => handleConfigChange('enableSmartCaching', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Refresh Interval</Label>
                <Select 
                  value={config.refreshIntervalMinutes.toString()} 
                  onValueChange={(value) => handleConfigChange('refreshIntervalMinutes', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                    <SelectItem value="720">12 hours</SelectItem>
                    <SelectItem value="1440">24 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  How often to automatically refresh data from Linear API
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cache Duration</Label>
                <Select 
                  value={(config.maxCacheAge / (1000 * 60 * 60)).toString()} 
                  onValueChange={(value) => handleConfigChange('maxCacheAge', parseInt(value) * 1000 * 60 * 60)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="48">48 hours</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  How long to keep cached data before considering it stale
                </p>
              </div>

              <div className="space-y-2">
                <Label>Daily API Call Limit</Label>
                <Select 
                  value={config.apiCallLimit.toString()} 
                  onValueChange={(value) => handleConfigChange('apiCallLimit', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 calls</SelectItem>
                    <SelectItem value="100">100 calls</SelectItem>
                    <SelectItem value="200">200 calls</SelectItem>
                    <SelectItem value="500">500 calls</SelectItem>
                    <SelectItem value="1000">1000 calls</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Alert when approaching this limit
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={clearCache} disabled={isLoading}>
              <Database className="h-4 w-4 mr-2" />
              Clear Cache
            </Button>
            <Button variant="outline" onClick={refreshNow} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {usagePercentage > 80 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>High API Usage:</strong> You've used {Math.round(usagePercentage)}% of your daily API limit. 
            Consider increasing cache duration or reducing refresh frequency.
          </AlertDescription>
        </Alert>
      )}

      {usageStats.cacheHitRate > 70 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Excellent Cache Performance:</strong> {Math.round(usageStats.cacheHitRate)}% cache hit rate 
            is saving you API calls and improving performance.
          </AlertDescription>
        </Alert>
      )}

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Reduce API Calls</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Increase cache duration for stable data</li>
                <li>• Use longer refresh intervals</li>
                <li>• Enable smart caching</li>
                <li>• Avoid frequent manual refreshes</li>
              </ul>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Improve Performance</h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Cache frequently accessed data</li>
                <li>• Use background refresh</li>
                <li>• Monitor cache hit rates</li>
                <li>• Clean up old data regularly</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiManagement;