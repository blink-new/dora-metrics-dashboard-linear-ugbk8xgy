import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  formattedValue?: string;
  displayText?: string;
  trend: number;
  rating: 'Elite' | 'High' | 'Medium' | 'Low';
  description?: string;
}

const MetricCard = ({ title, value, unit, formattedValue, displayText, trend, rating, description }: MetricCardProps) => {
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

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <Badge className={getRatingColor(rating)}>
          {rating}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline space-x-2">
          <div className="text-2xl font-bold text-gray-900">
            {displayText || formattedValue || value}
          </div>
          <div className="text-sm text-gray-500">
            {displayText ? '' : (formattedValue ? '' : unit)}
          </div>
        </div>
        <div className="flex items-center space-x-1 mt-2">
          {getTrendIcon()}
          <span className="text-xs text-gray-500">
            {getTrendText()}
          </span>
        </div>
        {description && (
          <p className="text-xs text-gray-500 mt-2">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricCard;