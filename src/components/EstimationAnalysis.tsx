import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { EstimationAnalysis as EstimationAnalysisType } from '@/lib/doraCalculator';
import { AlertTriangle, Clock, Target } from 'lucide-react';
import { formatBusinessDuration } from '@/lib/timeUtils';

interface EstimationAnalysisProps {
  data: EstimationAnalysisType;
}

const EstimationAnalysis = ({ data }: EstimationAnalysisProps) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">No estimation data available</p>
      </div>
    );
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-green-600 bg-green-50';
    if (accuracy >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getBottleneckSeverity = (overrun: number) => {
    if (overrun >= 200) return 'bg-red-100 text-red-800 border-red-200';
    if (overrun >= 100) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  return (
    <div className="space-y-6">
      {/* Estimation Accuracy by Story Points */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Estimation Accuracy by Story Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.accuracyByEstimate || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="estimate" 
                  label={{ value: 'Story Points', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === 'accuracy' ? `${value}%` : formatBusinessDuration(value),
                    name === 'accuracy' ? 'Accuracy' : 'Avg Actual Time'
                  ]}
                />
                <Bar dataKey="accuracy" fill="#10B981" name="accuracy" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            {(data.accuracyByEstimate || []).map((item) => (
              <div key={item.estimate} className={`text-center p-3 rounded-lg ${getAccuracyColor(item.accuracy)}`}>
                <div className="text-lg font-bold">{item.estimate}pt</div>
                <div className="text-sm opacity-80">{item.count} issues</div>
                <div className="text-sm font-medium">{item.accuracy}% accurate</div>
                <div className="text-xs opacity-70">{formatBusinessDuration(item.averageActual)} actual</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Velocity Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Velocity Trends (Planned vs Actual)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.velocityTrends || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis label={{ value: 'Story Points', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  labelFormatter={(value) => `Week of ${new Date(value).toLocaleDateString()}`}
                  formatter={(value: number, name: string) => [
                    `${value} ${name === 'planned' ? 'points' : 'issues'}`,
                    name === 'planned' ? 'Planned' : 'Actual'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="planned" 
                  stroke="#2563EB" 
                  strokeWidth={2}
                  name="planned"
                  dot={{ fill: '#2563EB', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="actual"
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                {Math.round((data.velocityTrends || []).reduce((sum, item) => sum + item.planned, 0) / Math.max((data.velocityTrends || []).length, 1))}
              </div>
              <div className="text-sm text-gray-600">Avg Planned</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">
                {Math.round((data.velocityTrends || []).reduce((sum, item) => sum + item.actual, 0) / Math.max((data.velocityTrends || []).length, 1))}
              </div>
              <div className="text-sm text-gray-600">Avg Actual</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {Math.round((data.velocityTrends || []).reduce((sum, item) => sum + item.accuracy, 0) / Math.max((data.velocityTrends || []).length, 1))}%
              </div>
              <div className="text-sm text-gray-600">Avg Accuracy</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottlenecks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Current Bottlenecks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data.bottlenecks || []).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No significant bottlenecks detected!</p>
              <p className="text-sm">All issues are completing within expected timeframes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(data.bottlenecks || []).map((bottleneck, index) => (
                <div key={bottleneck.issueId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{bottleneck.issueId}</span>
                      <Badge className={getBottleneckSeverity(bottleneck.overrun)}>
                        +{bottleneck.overrun}% overrun
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{bottleneck.title}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {bottleneck.estimate}pt estimated
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
{formatBusinessDuration(bottleneck.actualTime)} actual
                      </span>
                      {bottleneck.assignee && (
                        <span>Assigned to {bottleneck.assignee}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-600">
                      #{index + 1}
                    </div>
                    <div className="text-xs text-gray-500">Priority</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {(data.accuracyByEstimate || []).filter(item => item.accuracy >= 80).length}
              </div>
              <div className="text-sm text-gray-600">High Accuracy Estimates</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {(data.bottlenecks || []).length}
              </div>
              <div className="text-sm text-gray-600">Active Bottlenecks</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {Math.round((data.velocityTrends || []).reduce((sum, item) => sum + item.accuracy, 0) / Math.max((data.velocityTrends || []).length, 1))}%
              </div>
              <div className="text-sm text-gray-600">Velocity Accuracy</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {(data.accuracyByEstimate || []).find(item => item.estimate === 1)?.accuracy || 0}%
              </div>
              <div className="text-sm text-gray-600">Small Story Accuracy</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstimationAnalysis;