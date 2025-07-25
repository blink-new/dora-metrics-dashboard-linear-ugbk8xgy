import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { METRIC_DEFINITIONS } from '@/lib/metricDefinitions';

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  formattedValue?: string;
  displayText?: string;
  trend: number;
  rating: 'Elite' | 'High' | 'Medium' | 'Low';
  description?: string;
  details?: {
    totalDeployments?: number;
    failedDeployments?: number;
    failureDescription?: string;
  };
  metricKey?: string; // Key to lookup metric definition
}

const MetricCard = ({ title, value, unit, formattedValue, displayText, trend, rating, description, details, metricKey }: MetricCardProps) => {
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

  const getTrendIcon = () => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendText = () => {
    if (trend === 0) return 'No change';
    const direction = trend > 0 ? 'increase' : 'decrease';
    return `${Math.abs(trend)}% ${direction}`;
  };

  const getMetricDefinition = () => {
    if (!metricKey || !METRIC_DEFINITIONS[metricKey]) return null;
    return METRIC_DEFINITIONS[metricKey];
  };

  const renderTooltipContent = () => {
    const definition = getMetricDefinition();
    if (!definition) return null;

    return (
      <div className="max-w-sm space-y-2">
        <div className="font-semibold text-white">{definition.title}</div>
        <div className="text-xs text-gray-200">
          <div className="mb-2">
            <span className="font-medium">Formula:</span> {definition.formula}
          </div>
          <div className="mb-2">
            <span className="font-medium">Calculation:</span> {definition.calculation}
          </div>
          <div className="mb-2">
            <span className="font-medium">Scope:</span> {definition.filteringScope}
          </div>
          <div className="mb-1">
            <span className="font-medium">Includes:</span> {definition.includedStatuses.join(', ')}
          </div>
          {definition.excludedCases.length > 0 && (
            <div className="mb-1">
              <span className="font-medium">Excludes:</span> {definition.excludedCases.join(', ')}
            </div>
          )}
          <div className="text-xs text-blue-200 mt-2">
            <a href="#readme" className="underline hover:text-blue-100">
              See full definition →
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Card className="hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
        <CardHeader className="flex flex-col space-y-3 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <CardTitle className="text-sm font-medium text-gray-600 leading-tight">
                {title}
              </CardTitle>
              {metricKey && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-gray-900 text-white border-gray-700">
                    {renderTooltipContent()}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <Badge className={`${getRatingColor(rating)} flex-shrink-0`}>
              {rating}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-baseline space-x-2">
                <div className="text-2xl font-bold text-gray-900 leading-none">
                  {formattedValue || value}
                </div>
                <div className="text-sm text-gray-500">
                  {formattedValue ? '' : unit}
                </div>
              </div>
              {displayText && displayText !== (formattedValue || value.toString()) && (
                <div className="text-sm text-gray-600 font-normal">
                  {displayText}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-1">
              {getTrendIcon()}
              <span className="text-xs text-gray-500">
                {getTrendText()}
              </span>
            </div>
          </div>
          
          <div className="mt-3 space-y-2">
            {description && (
              <p className="text-xs text-gray-500 leading-relaxed">
                {description}
              </p>
            )}
            {details?.failureDescription && (
              <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border leading-relaxed">
                {details.failureDescription}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default MetricCard;