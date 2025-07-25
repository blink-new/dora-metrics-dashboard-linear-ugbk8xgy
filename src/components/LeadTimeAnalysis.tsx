import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { LeadTimeAnalysis as LeadTimeAnalysisType } from '@/lib/doraCalculator';
import { formatBusinessDuration } from '@/lib/timeUtils';
import { formatConfidenceInterval, formatPredictiveRange } from '@/lib/statisticsUtils';
import { Target, Clock, TrendingUp, BarChart3 } from 'lucide-react';

interface LeadTimeAnalysisProps {
  data: LeadTimeAnalysisType;
}

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const LeadTimeAnalysis = ({ data }: LeadTimeAnalysisProps) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">No cycle time data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cycle Time by Story Points */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Cycle Time by Story Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byEstimate || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="estimate" 
                  label={{ value: 'Story Points', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === 'averageLeadTime' ? formatBusinessDuration(value) : `${value}%`,
                    name === 'averageLeadTime' ? 'Avg Cycle Time' : 'Accuracy'
                  ]}
                />
                <Bar dataKey="averageLeadTime" fill="#2563EB" name="averageLeadTime" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {(data.byEstimate || []).map((item) => (
              <div key={item.estimate} className="p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-lg font-bold text-gray-900">{item.estimate}pt</div>
                  <Badge variant="outline">{item.count} issues</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">{formatBusinessDuration(item.averageLeadTime)} avg</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{item.accuracy}% accurate</span>
                  </div>
                  
                  {item.confidenceInterval && (
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-purple-600" />
                      <span className="text-xs text-gray-600">
                        CI: {formatConfidenceInterval(item.confidenceInterval, '%')}
                      </span>
                    </div>
                  )}
                  
                  {item.predictiveRange && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-600" />
                      <span className="text-xs text-gray-600">
                        Next: {formatPredictiveRange(item.predictiveRange, 'h')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cycle Time Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Cycle Time Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.distribution || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ range, percentage }) => `${range}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {(data.distribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} issues`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Cycle Time Trends (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: number) => [formatBusinessDuration(value), 'Cycle Time']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="leadTime" 
                    stroke="#2563EB" 
                    strokeWidth={2}
                    dot={{ fill: '#2563EB', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confidence Interval Data Source Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Confidence Interval Data Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">Statistical Analysis Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-800">Total Tasks Used:</span>
                <div className="text-lg font-bold text-green-600">
                  {(data.byEstimate || []).reduce((total, item) => total + item.count, 0)}
                </div>
                <span className="text-xs text-green-600">All completed tasks with estimates</span>
              </div>
              <div>
                <span className="font-medium text-green-800">Data Scope:</span>
                <div className="text-lg font-bold text-green-600">ALL CYCLES</div>
                <span className="text-xs text-green-600">Historical data from entire dataset</span>
              </div>
              <div>
                <span className="font-medium text-green-800">Sample Breakdown:</span>
                <div className="space-y-1">
                  {(data.byEstimate || []).map(item => (
                    <div key={item.estimate} className="flex justify-between text-xs">
                      <span>{item.estimate}pt:</span>
                      <span className="font-medium">{item.count} tasks</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 p-3 bg-white rounded border-l-4 border-green-400">
              <p className="text-sm text-gray-700">
                <strong>Confidence Intervals Use:</strong> All {(data.byEstimate || []).reduce((total, item) => total + item.count, 0)} completed tasks 
                across ALL cycles for statistical robustness. This provides reliable confidence intervals based on your team's 
                complete historical performance, not just the selected cycle.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Summary Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {(data.byEstimate || []).reduce((sum, item) => sum + item.count, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Issues</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {Math.round((data.byEstimate || []).reduce((sum, item) => sum + item.accuracy, 0) / Math.max((data.byEstimate || []).length, 1))}%
              </div>
              <div className="text-sm text-gray-600">Avg Accuracy</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {formatBusinessDuration((data.byEstimate || []).reduce((sum, item) => sum + item.averageLeadTime, 0) / Math.max((data.byEstimate || []).length, 1))}
              </div>
              <div className="text-sm text-gray-600">Avg Cycle Time</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {(data.distribution || []).find(d => d.range === '0-24h')?.percentage || 0}%
              </div>
              <div className="text-sm text-gray-600">Same Day</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadTimeAnalysis;