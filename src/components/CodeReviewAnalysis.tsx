import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CodeReviewAnalysis as CodeReviewAnalysisType } from '@/lib/doraCalculator';
import { formatBusinessDuration } from '@/lib/timeUtils';
import { Clock, GitPullRequest, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import MetricCard from './MetricCard';

interface CodeReviewAnalysisProps {
  data: CodeReviewAnalysisType;
}

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const CodeReviewAnalysis = ({ data }: CodeReviewAnalysisProps) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">No code review data available</p>
      </div>
    );
  }

  const getEstimateColor = (estimate?: number) => {
    if (!estimate) return 'bg-gray-100 text-gray-800';
    if (estimate <= 2) return 'bg-green-100 text-green-800';
    if (estimate <= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round((hours % 24) * 10) / 10;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  return (
    <div className="space-y-6">
      {/* Average Time in Code Review Metric Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <MetricCard
            title="Average Time in Code Review"
            value={data.averageTimeInReview.value}
            unit={data.averageTimeInReview.unit}
            formattedValue={data.averageTimeInReview.formattedValue}
            trend={data.averageTimeInReview.trend}
            rating={data.averageTimeInReview.rating}
            description="Average time from code review start to merge"
          />
        </div>
        
        {/* Quick Stats */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <GitPullRequest className="h-5 w-5 text-blue-600" />
                Code Review Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{data.tasks.length}</div>
                  <div className="text-sm text-gray-600">Total Reviews</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {data.distribution.find(d => d.range === '< 4 hours')?.percentage || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Same Day</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {data.distribution.find(d => d.range === '4-24 hours')?.percentage || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Next Day</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {data.distribution.find(d => d.range === '> 1 week')?.percentage || 0}%
                  </div>
                  <div className="text-sm text-gray-600">Over 1 Week</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Review Time by Story Points */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Review Time by Story Points</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byEstimate.filter(item => item.count > 0)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="estimate" 
                  label={{ value: 'Story Points', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number) => [formatBusinessDuration(value), 'Avg Review Time']}
                />
                <Bar dataKey="averageReviewTime" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            {data.byEstimate.filter(item => item.count > 0).map((item) => (
              <div key={item.estimate} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-900">{item.estimate}pt</div>
                <div className="text-sm text-gray-600">{item.count} reviews</div>
                <div className="text-sm text-blue-600">{formatDuration(item.averageReviewTime)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Review Time Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Review Time Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.distribution.filter(item => item.count > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ range, percentage }) => `${range}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {data.distribution.filter(item => item.count > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} reviews`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Review Performance Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Fast Reviews</span>
                </div>
                <div className="text-lg font-bold text-green-600">
                  {data.distribution.find(d => d.range === '< 4 hours')?.count || 0}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Standard Reviews</span>
                </div>
                <div className="text-lg font-bold text-yellow-600">
                  {(data.distribution.find(d => d.range === '4-24 hours')?.count || 0) + 
                   (data.distribution.find(d => d.range === '1-3 days')?.count || 0)}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Slow Reviews</span>
                </div>
                <div className="text-lg font-bold text-red-600">
                  {(data.distribution.find(d => d.range === '3-7 days')?.count || 0) + 
                   (data.distribution.find(d => d.range === '> 1 week')?.count || 0)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Code Review Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {data.tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <GitPullRequest className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No code review tasks found</p>
              <p className="text-sm">Tasks need to transition from "Code Review" to "Merged" states</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Task ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Title</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Estimate</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Time in Review</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Review Started</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Merged</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.slice(0, 20).map((task) => (
                    <tr key={task.issueId} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm font-medium text-blue-600">
                          {task.issueId}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="max-w-xs truncate" title={task.title}>
                          {task.title}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {task.estimate ? (
                          <Badge className={getEstimateColor(task.estimate)}>
                            {task.estimate}pt
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-medium">
                          {formatDuration(task.timeInReview)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-600">
                        {new Date(task.reviewStartedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-600">
                        {new Date(task.mergedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.tasks.length > 20 && (
                <div className="text-center py-4 text-sm text-gray-500">
                  Showing top 20 of {data.tasks.length} tasks
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CodeReviewAnalysis;