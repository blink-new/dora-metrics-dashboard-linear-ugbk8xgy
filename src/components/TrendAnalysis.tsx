import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar, 
  BarChart3, 
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Database,
  Clock
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { dataStorage, TrendComparison, DataSnapshot } from '@/lib/dataStorage';
import { formatBusinessDuration } from '@/lib/timeUtils';

interface TrendAnalysisProps {
  userId: string;
  teamId: string | null;
  cycleId: string | null;
  period: string;
  onExport?: (data: string) => void;
  onImport?: (file: File) => void;
}

const TrendAnalysis: React.FC<TrendAnalysisProps> = ({
  userId,
  teamId,
  cycleId,
  period,
  onExport,
  onImport
}) => {
  const [trendComparison, setTrendComparison] = useState<TrendComparison | null>(null);
  const [historicalSnapshots, setHistoricalSnapshots] = useState<DataSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('30');
  const [cacheStats, setCacheStats] = useState<any>(null);

  useEffect(() => {
    const loadTrendData = async () => {
      if (!userId) return;

      setIsLoading(true);
      setError('');

      try {
        console.log('TrendAnalysis: Loading data with params:', { userId, teamId, cycleId, period, selectedTimeRange });
        
        // Load trend comparison
        const comparison = await dataStorage.calculateTrendComparison(userId, teamId, cycleId, period);
        console.log('TrendAnalysis: Trend comparison result:', comparison);
        setTrendComparison(comparison);

        // Load historical snapshots
        const snapshots = await dataStorage.getHistoricalSnapshots(
          userId, 
          teamId, 
          cycleId, 
          period, 
          parseInt(selectedTimeRange)
        );
        console.log('TrendAnalysis: Historical snapshots result:', snapshots.length, 'snapshots found');
        setHistoricalSnapshots(snapshots);

        // Load cache stats with error handling
        try {
          const stats = await dataStorage.getCacheStats(userId);
          setCacheStats(stats);
        } catch (statsError) {
          console.warn('Failed to load cache stats:', statsError);
          // Set default stats if loading fails
          setCacheStats({
            totalSnapshots: 0,
            oldestSnapshot: null,
            newestSnapshot: null,
            totalSizeEstimate: 0
          });
        }
      } catch (err) {
        console.error('Error loading trend data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load trend data');
      } finally {
        setIsLoading(false);
      }
    };

    loadTrendData();
  }, [userId, teamId, cycleId, period, selectedTimeRange]);

  const refreshData = async () => {
    if (!userId) return;

    setIsLoading(true);
    setError('');

    try {
      // Load trend comparison
      const comparison = await dataStorage.calculateTrendComparison(userId, teamId, cycleId, period);
      setTrendComparison(comparison);

      // Load historical snapshots
      const snapshots = await dataStorage.getHistoricalSnapshots(
        userId, 
        teamId, 
        cycleId, 
        period, 
        parseInt(selectedTimeRange)
      );
      setHistoricalSnapshots(snapshots);

      // Load cache stats with error handling
      try {
        const stats = await dataStorage.getCacheStats(userId);
        setCacheStats(stats);
      } catch (statsError) {
        console.warn('Failed to load cache stats:', statsError);
        // Set default stats if loading fails
        setCacheStats({
          totalSnapshots: 0,
          oldestSnapshot: null,
          newestSnapshot: null,
          totalSizeEstimate: 0
        });
      }
    } catch (err) {
      console.error('Error loading trend data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trend data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!userId) return;

    try {
      const exportData = await dataStorage.exportData(userId, teamId, cycleId, parseInt(selectedTimeRange));
      
      if (onExport) {
        onExport(exportData);
      } else {
        // Default download behavior
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dora-metrics-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    try {
      const text = await file.text();
      const importedCount = await dataStorage.importData(userId, text);
      
      // Refresh data after import
      await refreshData();
      
      alert(`Successfully imported ${importedCount} snapshots`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import data');
    }
  };

  const handleCleanup = async () => {
    if (!userId) return;

    if (!confirm('This will delete snapshots older than 90 days. Continue?')) return;

    try {
      const deletedCount = await dataStorage.cleanupOldSnapshots(userId, 90);
      await refreshData(); // Refresh stats
      alert(`Cleaned up ${deletedCount} old snapshots`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup data');
    }
  };



  const getTrendIcon = (value: number) => {
    if (value > 5) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (value < -5) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 5) return 'text-green-600';
    if (value < -5) return 'text-red-600';
    return 'text-gray-600';
  };

  // Prepare chart data from historical snapshots
  const chartData = historicalSnapshots
    .slice(0, 10) // Last 10 snapshots
    .reverse()
    .map(snapshot => {
      try {
        const metricsData = JSON.parse(snapshot.metrics_data || '{}');
        const metrics = metricsData.doraMetrics;
        
        // Ensure metrics exist and have the expected structure
        if (!metrics) {
          return null;
        }
        
        return {
          date: new Date(snapshot.snapshot_date).toLocaleDateString(),
          deploymentFreq: metrics.deploymentFrequency?.value || 0,
          leadTime: metrics.leadTimeForChanges?.value || 0,
          failureRate: metrics.changeFailureRate?.value || 0,
          recoveryTime: metrics.timeToRecovery?.value || 0
        };
      } catch (error) {
        console.warn('Error parsing snapshot metrics:', error);
        return null;
      }
    })
    .filter(Boolean); // Remove null entries

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Trend Analysis</h2>
          <p className="text-gray-600">Compare metrics over time and spot improvement opportunities</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Cache Statistics */}
      {cacheStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Storage Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{cacheStats.totalSnapshots}</div>
                <div className="text-sm text-gray-600">Total Snapshots</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(cacheStats.totalSizeEstimate / 1024)} KB
                </div>
                <div className="text-sm text-gray-600">Storage Used</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-sm font-medium text-purple-600">
                  {cacheStats.oldestSnapshot 
                    ? new Date(cacheStats.oldestSnapshot).toLocaleDateString()
                    : 'N/A'
                  }
                </div>
                <div className="text-sm text-gray-600">Oldest Data</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-sm font-medium text-orange-600">
                  {cacheStats.newestSnapshot 
                    ? new Date(cacheStats.newestSnapshot).toLocaleDateString()
                    : 'N/A'
                  }
                </div>
                <div className="text-sm text-gray-600">Latest Data</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend Comparison */}
      {trendComparison && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Period-over-Period Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Deployment Frequency</span>
                  {getTrendIcon(trendComparison.trends.deploymentFrequency)}
                </div>
                <div className="text-2xl font-bold">
                  {trendComparison.current.metrics.deploymentFrequency.value}
                  <span className="text-sm text-gray-500 ml-1">
                    {trendComparison.current.metrics.deploymentFrequency.unit}
                  </span>
                </div>
                <div className={`text-sm ${getTrendColor(trendComparison.trends.deploymentFrequency)}`}>
                  {trendComparison.trends.deploymentFrequency > 0 ? '+' : ''}
                  {trendComparison.trends.deploymentFrequency}% vs previous
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Lead Time</span>
                  {getTrendIcon(trendComparison.trends.leadTime)}
                </div>
                <div className="text-2xl font-bold">
                  {trendComparison.current.metrics.leadTimeForChanges.value}
                  <span className="text-sm text-gray-500 ml-1">days</span>
                </div>
                <div className={`text-sm ${getTrendColor(trendComparison.trends.leadTime)}`}>
                  {trendComparison.trends.leadTime > 0 ? '+' : ''}
                  {trendComparison.trends.leadTime}% vs previous
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Failure Rate</span>
                  {getTrendIcon(trendComparison.trends.changeFailureRate)}
                </div>
                <div className="text-2xl font-bold">
                  {trendComparison.current.metrics.changeFailureRate.value}%
                </div>
                <div className={`text-sm ${getTrendColor(trendComparison.trends.changeFailureRate)}`}>
                  {trendComparison.trends.changeFailureRate > 0 ? '+' : ''}
                  {trendComparison.trends.changeFailureRate}% vs previous
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Recovery Time</span>
                  {getTrendIcon(trendComparison.trends.timeToRecovery)}
                </div>
                <div className="text-2xl font-bold">
                  {trendComparison.current.metrics.timeToRecovery.value}
                  <span className="text-sm text-gray-500 ml-1">days</span>
                </div>
                <div className={`text-sm ${getTrendColor(trendComparison.trends.timeToRecovery)}`}>
                  {trendComparison.trends.timeToRecovery > 0 ? '+' : ''}
                  {trendComparison.trends.timeToRecovery}% vs previous
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>
                  Comparing {new Date(trendComparison.current.date).toLocaleDateString()} 
                  {trendComparison.previous && (
                    <> vs {new Date(trendComparison.previous.date).toLocaleDateString()}</>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead Time Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`${value} days`, 'Lead Time']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="leadTime" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={{ fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deployment Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Deployments']}
                  />
                  <Bar dataKey="deploymentFreq" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            
            <div>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                id="import-file"
              />
              <Button variant="outline" asChild>
                <label htmlFor="import-file" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Data
                </label>
              </Button>
            </div>
            
            <Button variant="outline" onClick={handleCleanup}>
              <Trash2 className="h-4 w-4 mr-2" />
              Cleanup Old Data
            </Button>

          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Smart Caching:</strong> Data is automatically cached to reduce API calls. 
              Historical snapshots enable trend analysis and comparison over time.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* No Data State */}
      {!isLoading && historicalSnapshots.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Historical Data</h3>
            <p className="text-gray-500 mb-4">
              Start collecting data to see trends and comparisons. 
              Data will be automatically saved as you use the dashboard.
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>How to collect data:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-left max-w-md mx-auto">
                <li>Connect to Linear API in the Overview tab</li>
                <li>Load data by selecting a team and refreshing</li>
                <li>Data snapshots are automatically saved for trend analysis</li>
                <li>Return here after loading data multiple times to see trends</li>
              </ol>
            </div>
            {cacheStats && cacheStats.totalSnapshots === 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>No snapshots found.</strong> Make sure you're connected to Linear and have loaded data in the Overview tab.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TrendAnalysis;