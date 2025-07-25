import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { DORAMetrics, CodeReviewAnalysis } from '@/lib/doraCalculator';
import { formatBusinessDuration } from '@/lib/timeUtils';

interface MetricRelationshipAnalysisProps {
  doraMetrics: DORAMetrics;
  codeReviewAnalysis: CodeReviewAnalysis;
}

const MetricRelationshipAnalysis = ({ doraMetrics, codeReviewAnalysis }: MetricRelationshipAnalysisProps) => {
  // Convert all metrics to hours for comparison
  const leadTimeHours = doraMetrics.leadTimeForChanges.value * 8; // business days to hours (8 hours per day)
  const codeReviewHours = codeReviewAnalysis.averageTimeInReview.value; // already in hours
  const deployTimeHours = (doraMetrics.timeToDeploy?.value || 0) * 8; // business days to hours (8 hours per day)

  // Debug logging to understand the values
  console.log('🔍 Metric Relationship Analysis Debug:');
  console.log('- Lead Time for Changes:', doraMetrics.leadTimeForChanges.value, 'business days =', leadTimeHours, 'hours');
  console.log('- Average Time in Code Review:', codeReviewAnalysis.averageTimeInReview.value, 'hours');
  console.log('- Time to Deploy:', doraMetrics.timeToDeploy?.value || 0, 'business days =', deployTimeHours, 'hours');

  // Calculate the sum of code review + deploy time
  const sumHours = codeReviewHours + deployTimeHours;
  
  // Calculate the difference and percentage difference
  const differenceHours = leadTimeHours - sumHours;
  const percentageDifference = leadTimeHours > 0 ? Math.abs(differenceHours / leadTimeHours) * 100 : 0;
  
  // Determine if the formula holds (within 10% tolerance)
  const formulaHolds = percentageDifference <= 10;
  const tolerance = 10; // 10% tolerance
  


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Metric Relationship Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Formula Verification */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">Formula Verification</h3>
            <div className="text-sm space-y-2">
              <div className="font-mono bg-white p-2 rounded border">
                Lead Time for Changes = Average Time in Code Review + Time to Deploy
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {formatBusinessDuration(leadTimeHours)}
                  </div>
                  <div className="text-sm text-gray-600">Lead Time for Changes</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {formatBusinessDuration(codeReviewHours)} + {formatBusinessDuration(deployTimeHours)}
                  </div>
                  <div className="text-sm text-gray-600">Code Review + Deploy Time</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${formulaHolds ? 'text-green-600' : 'text-red-600'}`}>
                    {formatBusinessDuration(sumHours)}
                  </div>
                  <div className="text-sm text-gray-600">Sum</div>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Result */}
          <Alert className={formulaHolds ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
            {formulaHolds ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
            <AlertDescription className={formulaHolds ? "text-green-800" : "text-yellow-800"}>
              <div className="space-y-2">
                <div className="font-semibold">
                  {formulaHolds 
                    ? `✅ Formula holds true (within ${tolerance}% tolerance)`
                    : `⚠️ Formula does not hold - there's a ${Math.round(percentageDifference)}% difference`
                  }
                </div>
                <div>
                  <strong>Difference:</strong> {formatBusinessDuration(Math.abs(differenceHours))} 
                  {differenceHours > 0 ? ' missing from the sum' : ' extra in the sum'}
                </div>
                {!formulaHolds && (
                  <div className="text-sm">
                    This suggests there are other components in the lead time that aren't captured by code review and deployment time alone.
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Detailed Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Metrics (Hours)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Lead Time for Changes:</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {formatBusinessDuration(leadTimeHours)}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Average Time in Code Review:</span>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {formatBusinessDuration(codeReviewHours)}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Time to Deploy:</span>
                <Badge variant="outline" className="bg-purple-50 text-purple-700">
                  {formatBusinessDuration(deployTimeHours)}
                </Badge>
              </div>
              <hr />
              <div className="flex justify-between items-center font-semibold">
                <span>Sum (Code Review + Deploy):</span>
                <Badge variant="outline" className="bg-gray-50 text-gray-700">
                  {formatBusinessDuration(sumHours)}
                </Badge>
              </div>
              <div className="flex justify-between items-center font-semibold">
                <span>Difference:</span>
                <Badge 
                  variant="outline" 
                  className={differenceHours >= 0 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"}
                >
                  {differenceHours >= 0 ? '+' : ''}{formatBusinessDuration(Math.abs(differenceHours))}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {formulaHolds ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800">Excellent! Your metrics align perfectly.</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    The formula holds true (within {tolerance}% tolerance), indicating that code review and deployment time account for 
                    most of your lead time. This suggests a very streamlined development process where the main bottlenecks 
                    are in code review and deployment phases.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium text-yellow-800">Formula variance detected</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    There's a {Math.round(percentageDifference)}% difference ({formatBusinessDuration(Math.abs(differenceHours))}) 
                    between your Lead Time for Changes and the sum of Code Review + Deploy Time. Since you mentioned that 
                    a day equals a business day for your team, this difference might be due to:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 ml-6">
                    <li>• Development time before code review starts</li>
                    <li>• Testing or QA phases between review and deployment</li>
                    <li>• Waiting time for approvals or resources</li>
                    <li>• Time spent on rework or iterations</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetricRelationshipAnalysis;