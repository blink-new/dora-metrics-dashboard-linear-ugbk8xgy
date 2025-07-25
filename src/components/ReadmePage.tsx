import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Clock, AlertTriangle, Lightbulb } from 'lucide-react';
import { METRIC_DEFINITIONS, README_CONTENT } from '@/lib/metricDefinitions';

const ReadmePage = () => {
  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'Elite':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'High':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <BookOpen className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">{README_CONTENT.title}</h1>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          {README_CONTENT.introduction}
        </p>
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>Last updated: {README_CONTENT.lastUpdated}</span>
        </div>
      </div>

      {/* Data Source */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>{README_CONTENT.dataSource.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-gray-700">{README_CONTENT.dataSource.description}</p>
          <p className="text-gray-700">{README_CONTENT.dataSource.scope}</p>
        </CardContent>
      </Card>

      {/* Metric Definitions */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Metric Definitions</h2>
        
        {Object.entries(METRIC_DEFINITIONS).map(([key, definition]) => (
          <Card key={key} id={`metric-${key}`}>
            <CardHeader>
              <CardTitle className="text-xl text-gray-900">{definition.title}</CardTitle>
              <p className="text-gray-600">{definition.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Formula */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Formula</h4>
                <code className="bg-gray-100 px-3 py-2 rounded text-sm font-mono block">
                  {definition.formula}
                </code>
              </div>

              {/* Calculation Details */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Calculation Method</h4>
                <p className="text-gray-700">{definition.calculation}</p>
              </div>

              {/* Scope */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Filtering Scope</h4>
                <p className="text-gray-700">{definition.filteringScope}</p>
              </div>

              {/* Included/Excluded */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Included Statuses/Types</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {definition.includedStatuses.map((status, index) => (
                      <li key={index} className="text-sm">{status}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Excluded Cases</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {definition.excludedCases.map((exclusion, index) => (
                      <li key={index} className="text-sm">{exclusion}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Performance Thresholds */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Performance Thresholds</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center">
                    <Badge className={getRatingColor('Elite')}>Elite</Badge>
                    <p className="text-xs text-gray-600 mt-1">{definition.thresholds.elite}</p>
                  </div>
                  <div className="text-center">
                    <Badge className={getRatingColor('High')}>High</Badge>
                    <p className="text-xs text-gray-600 mt-1">{definition.thresholds.high}</p>
                  </div>
                  <div className="text-center">
                    <Badge className={getRatingColor('Medium')}>Medium</Badge>
                    <p className="text-xs text-gray-600 mt-1">{definition.thresholds.medium}</p>
                  </div>
                  <div className="text-center">
                    <Badge className={getRatingColor('Low')}>Low</Badge>
                    <p className="text-xs text-gray-600 mt-1">{definition.thresholds.low}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {definition.notes && definition.notes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Additional Notes</h4>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {definition.notes.map((note, index) => (
                      <li key={index} className="text-sm">{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calculation Methodology */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>{README_CONTENT.calculations.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Business Hours</h4>
            <p className="text-gray-700">{README_CONTENT.calculations.businessHours}</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Story Point Estimates</h4>
            <p className="text-gray-700">{README_CONTENT.calculations.estimates}</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Label-Based Detection</h4>
            <p className="text-gray-700">{README_CONTENT.calculations.labels}</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Trend Analysis</h4>
            <p className="text-gray-700">{README_CONTENT.calculations.trends}</p>
          </div>
        </CardContent>
      </Card>

      {/* Cycle Time Analysis */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800">{README_CONTENT.cycleTimeAnalysis.title}</CardTitle>
          <p className="text-blue-700">{README_CONTENT.cycleTimeAnalysis.definition}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Calculation Steps</h4>
            <ol className="list-decimal list-inside text-blue-800 space-y-1">
              {README_CONTENT.cycleTimeAnalysis.calculationSteps.map((step, index) => (
                <li key={index} className="text-sm">{step}</li>
              ))}
            </ol>
          </div>
          
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Business Hours Algorithm</h4>
            <div className="bg-blue-100 p-3 rounded text-sm text-blue-800">
              <p><strong>Working Hours:</strong> {README_CONTENT.cycleTimeAnalysis.businessHoursAlgorithm.workingHours}</p>
              <p><strong>Working Days:</strong> {README_CONTENT.cycleTimeAnalysis.businessHoursAlgorithm.workingDays}</p>
              <p><strong>Example:</strong> {README_CONTENT.cycleTimeAnalysis.businessHoursAlgorithm.example}</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Data Collection Requirements</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-blue-800 mb-1">Required Fields</h5>
                <ul className="list-disc list-inside text-blue-700 text-sm space-y-1">
                  {README_CONTENT.cycleTimeAnalysis.dataCollection.requiredFields.map((field, index) => (
                    <li key={index}>{field}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-blue-800 mb-1">Filtering Criteria</h5>
                <ul className="list-disc list-inside text-blue-700 text-sm space-y-1">
                  {README_CONTENT.cycleTimeAnalysis.dataCollection.filteringCriteria.map((criteria, index) => (
                    <li key={index}>{criteria}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>


        </CardContent>
      </Card>

      {/* Story Point Accuracy Analysis */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800">{README_CONTENT.storyPointAccuracy.title}</CardTitle>
          <p className="text-green-700 font-mono text-sm bg-green-100 px-2 py-1 rounded">
            {README_CONTENT.storyPointAccuracy.coreFormula}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-green-900 mb-2">Calculation Methodology</h4>
            <ol className="list-decimal list-inside text-green-800 space-y-1">
              {README_CONTENT.storyPointAccuracy.methodology.map((step, index) => (
                <li key={index} className="text-sm">{step}</li>
              ))}
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-green-900 mb-2">Team Baseline Establishment</h4>
            <div className="bg-green-100 p-3 rounded text-sm text-green-800">
              <p><strong>Calculation:</strong> {README_CONTENT.storyPointAccuracy.teamBaseline.calculation}</p>
              <p><strong>Example:</strong> {README_CONTENT.storyPointAccuracy.teamBaseline.example}</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-green-900 mb-2">Accuracy Categories</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-100 p-2 rounded text-center">
                <Badge className="bg-green-200 text-green-800">Excellent</Badge>
                <p className="text-xs text-green-700 mt-1">{README_CONTENT.storyPointAccuracy.accuracyCategories.excellent}</p>
              </div>
              <div className="bg-yellow-100 p-2 rounded text-center">
                <Badge className="bg-yellow-200 text-yellow-800">Good</Badge>
                <p className="text-xs text-yellow-700 mt-1">{README_CONTENT.storyPointAccuracy.accuracyCategories.good}</p>
              </div>
              <div className="bg-red-100 p-2 rounded text-center">
                <Badge className="bg-red-200 text-red-800">Poor</Badge>
                <p className="text-xs text-red-700 mt-1">{README_CONTENT.storyPointAccuracy.accuracyCategories.poor}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-green-900 mb-2">Story Point Breakdown Analysis</h4>
            <div className="space-y-3">
              {Object.entries(README_CONTENT.storyPointAccuracy.storyPointBreakdown).map(([points, data]) => (
                <div key={points} className="bg-green-100 p-3 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-green-800">{points.replace('-', ' ')} Story</span>
                    <Badge className="bg-green-200 text-green-800">{data.accuracyTarget}</Badge>
                  </div>
                  <p className="text-sm text-green-700"><strong>Expected Range:</strong> {data.expectedRange}</p>
                  <p className="text-xs text-green-600">{data.description}</p>
                </div>
              ))}
            </div>
          </div>


        </CardContent>
      </Card>

      {/* Bottleneck Detection */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-800">{README_CONTENT.bottleneckDetection.title}</CardTitle>
          <p className="text-orange-700">{README_CONTENT.bottleneckDetection.thresholdMultiplier}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-orange-900 mb-2">Severity Levels</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-yellow-100 p-2 rounded text-center">
                <Badge className="bg-yellow-200 text-yellow-800">Low</Badge>
                <p className="text-xs text-yellow-700 mt-1">{README_CONTENT.bottleneckDetection.severityLevels.low}</p>
              </div>
              <div className="bg-orange-100 p-2 rounded text-center">
                <Badge className="bg-orange-200 text-orange-800">Medium</Badge>
                <p className="text-xs text-orange-700 mt-1">{README_CONTENT.bottleneckDetection.severityLevels.medium}</p>
              </div>
              <div className="bg-red-100 p-2 rounded text-center">
                <Badge className="bg-red-200 text-red-800">High</Badge>
                <p className="text-xs text-red-700 mt-1">{README_CONTENT.bottleneckDetection.severityLevels.high}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-orange-900 mb-2">Real Example</h4>
            <div className="bg-orange-100 p-3 rounded text-sm text-orange-800">
              <p><strong>Scenario:</strong> {README_CONTENT.bottleneckDetection.realExample.scenario}</p>
              <p><strong>Expected:</strong> {README_CONTENT.bottleneckDetection.realExample.expected}</p>
              <p><strong>Actual:</strong> {README_CONTENT.bottleneckDetection.realExample.actual}</p>
              <p><strong>Calculation:</strong> {README_CONTENT.bottleneckDetection.realExample.calculation}</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-orange-900 mb-2">Alert Triggers</h4>
            <ul className="list-disc list-inside text-orange-800 space-y-1">
              {README_CONTENT.bottleneckDetection.alertTriggers.map((trigger, index) => (
                <li key={index} className="text-sm">{trigger}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Intervals & Predictive Analytics */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-purple-800">{README_CONTENT.confidenceIntervals.title}</CardTitle>
          <p className="text-purple-700">{README_CONTENT.confidenceIntervals.methodology}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-purple-900 mb-2">Statistical Formula</h4>
            <div className="bg-purple-100 p-3 rounded text-sm text-purple-800 font-mono text-center">
              {README_CONTENT.confidenceIntervals.calculation}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-purple-900 mb-2">Predictive Example</h4>
            <div className="bg-purple-100 p-3 rounded text-sm text-purple-800">
              <p><strong>Scenario:</strong> {README_CONTENT.confidenceIntervals.predictiveExample.scenario}</p>
              <p><strong>Mean:</strong> {README_CONTENT.confidenceIntervals.predictiveExample.mean}</p>
              <p><strong>Standard Deviation:</strong> {README_CONTENT.confidenceIntervals.predictiveExample.standardDeviation}</p>
              <p><strong>95% Confidence Interval:</strong> {README_CONTENT.confidenceIntervals.predictiveExample.confidenceInterval}</p>
              <p><strong>Interpretation:</strong> {README_CONTENT.confidenceIntervals.predictiveExample.interpretation}</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-purple-900 mb-2">Practical Use</h4>
            <p className="text-purple-700 text-sm">{README_CONTENT.confidenceIntervals.practicalUse}</p>
          </div>
        </CardContent>
      </Card>

      {/* Limitations */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            <span>{README_CONTENT.limitations.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-yellow-800 space-y-2">
            {README_CONTENT.limitations.items.map((item, index) => (
              <li key={index} className="text-sm">{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Improvements */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-blue-800">
            <Lightbulb className="h-5 w-5" />
            <span>{README_CONTENT.improvements.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-blue-800 space-y-2">
            {README_CONTENT.improvements.items.map((item, index) => (
              <li key={index} className="text-sm">{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-8">
        <Separator className="mb-4" />
        <p className="text-sm text-gray-500">
          This documentation is automatically generated and updated with each dashboard deployment.
        </p>
      </div>
    </div>
  );
};

export default ReadmePage;