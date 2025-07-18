import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { LeadTimeAnalysis as LeadTimeAnalysisType } from '@/lib/doraCalculator';
import { formatBusinessDuration } from '@/lib/timeUtils';

interface LeadTimeAnalysisProps {
  data: LeadTimeAnalysisType;
}

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const LeadTimeAnalysis = ({ data }: LeadTimeAnalysisProps) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">No lead time data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lead Time by Story Points */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Lead Time by Story Points</CardTitle>
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
                    name === 'averageLeadTime' ? 'Avg Lead Time' : 'Accuracy'
                  ]}
                />
                <Bar dataKey="averageLeadTime" fill="#2563EB" name="averageLeadTime" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            {(data.byEstimate || []).map((item) => (
              <div key={item.estimate} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-900">{item.estimate}pt</div>
                <div className="text-sm text-gray-600">{item.count} issues</div>
                <div className="text-sm text-green-600">{item.accuracy}% accurate</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lead Time Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Lead Time Distribution</CardTitle>
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
            <CardTitle className="text-lg font-semibold">Lead Time Trends (30 Days)</CardTitle>
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
                    formatter={(value: number) => [formatBusinessDuration(value), 'Lead Time']}
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
              <div className="text-sm text-gray-600">Avg Lead Time</div>
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