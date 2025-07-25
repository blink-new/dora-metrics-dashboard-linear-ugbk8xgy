/**
 * Statistical utilities for confidence intervals and predictive analytics
 */

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number; // e.g., 95 for 95%
}

export interface PredictiveRange {
  expectedValue: number;
  minValue: number;
  maxValue: number;
  standardError: number;
  sampleSize: number;
}

export interface StatisticalSummary {
  mean: number;
  median: number;
  standardDeviation: number;
  standardError: number;
  sampleSize: number;
  confidenceInterval: ConfidenceInterval;
  predictiveRange: PredictiveRange;
}

/**
 * Calculate mean of an array of numbers
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Calculate median of an array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Calculate standard deviation of an array of numbers
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  
  const mean = calculateMean(values);
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
  const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / (values.length - 1);
  
  return Math.sqrt(variance);
}

/**
 * Calculate standard error of the mean
 */
export function calculateStandardError(values: number[]): number {
  if (values.length <= 1) return 0;
  
  const standardDeviation = calculateStandardDeviation(values);
  return standardDeviation / Math.sqrt(values.length);
}

/**
 * Get t-value for confidence interval calculation
 * Using approximation for common confidence levels and sample sizes
 */
export function getTValue(confidenceLevel: number, degreesOfFreedom: number): number {
  // Common t-values for 95% confidence interval
  const tTable95: { [key: number]: number } = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042, 40: 2.021,
    50: 2.009, 60: 2.000, 100: 1.984, 1000: 1.962
  };
  
  // Common t-values for 90% confidence interval
  const tTable90: { [key: number]: number } = {
    1: 6.314, 2: 2.920, 3: 2.353, 4: 2.132, 5: 2.015,
    6: 1.943, 7: 1.895, 8: 1.860, 9: 1.833, 10: 1.812,
    15: 1.753, 20: 1.725, 25: 1.708, 30: 1.697, 40: 1.684,
    50: 1.676, 60: 1.671, 100: 1.660, 1000: 1.645
  };
  
  // Common t-values for 99% confidence interval
  const tTable99: { [key: number]: number } = {
    1: 63.657, 2: 9.925, 3: 5.841, 4: 4.604, 5: 4.032,
    6: 3.707, 7: 3.499, 8: 3.355, 9: 3.250, 10: 3.169,
    15: 2.947, 20: 2.845, 25: 2.787, 30: 2.750, 40: 2.704,
    50: 2.678, 60: 2.660, 100: 2.626, 1000: 2.576
  };
  
  let tTable: { [key: number]: number };
  
  if (confidenceLevel === 90) {
    tTable = tTable90;
  } else if (confidenceLevel === 99) {
    tTable = tTable99;
  } else {
    // Default to 95%
    tTable = tTable95;
  }
  
  // Find closest degrees of freedom in table
  const availableDf = Object.keys(tTable).map(Number).sort((a, b) => a - b);
  
  if (degreesOfFreedom >= 1000) {
    return tTable[1000];
  }
  
  // Find exact match or closest higher value
  for (const df of availableDf) {
    if (degreesOfFreedom <= df) {
      return tTable[df];
    }
  }
  
  // Fallback to largest available
  return tTable[availableDf[availableDf.length - 1]];
}

/**
 * Calculate confidence interval for a sample mean
 */
export function calculateConfidenceInterval(
  values: number[], 
  confidenceLevel: number = 95
): ConfidenceInterval {
  if (values.length <= 1) {
    return {
      lower: 0,
      upper: 0,
      confidence: confidenceLevel
    };
  }
  
  const mean = calculateMean(values);
  const standardError = calculateStandardError(values);
  const degreesOfFreedom = values.length - 1;
  const tValue = getTValue(confidenceLevel, degreesOfFreedom);
  
  const marginOfError = tValue * standardError;
  
  return {
    lower: Math.max(0, mean - marginOfError), // Ensure non-negative for time values
    upper: mean + marginOfError,
    confidence: confidenceLevel
  };
}

/**
 * Calculate predictive range for future observations
 * This is wider than confidence interval as it accounts for individual variation
 */
export function calculatePredictiveRange(
  values: number[], 
  confidenceLevel: number = 95
): PredictiveRange {
  if (values.length <= 1) {
    const singleValue = values.length === 1 ? values[0] : 0;
    return {
      expectedValue: singleValue,
      minValue: singleValue,
      maxValue: singleValue,
      standardError: 0,
      sampleSize: values.length
    };
  }
  
  const mean = calculateMean(values);
  const standardDeviation = calculateStandardDeviation(values);
  const standardError = calculateStandardError(values);
  const degreesOfFreedom = values.length - 1;
  const tValue = getTValue(confidenceLevel, degreesOfFreedom);
  
  // Prediction interval is wider than confidence interval
  // It includes both sampling error and individual variation
  const predictionError = tValue * standardDeviation * Math.sqrt(1 + (1 / values.length));
  
  return {
    expectedValue: mean,
    minValue: Math.max(0, mean - predictionError), // Ensure non-negative for time values
    maxValue: mean + predictionError,
    standardError,
    sampleSize: values.length
  };
}

/**
 * Calculate complete statistical summary with confidence intervals and predictive analytics
 */
export function calculateStatisticalSummary(
  values: number[], 
  confidenceLevel: number = 95
): StatisticalSummary {
  const mean = calculateMean(values);
  const median = calculateMedian(values);
  const standardDeviation = calculateStandardDeviation(values);
  const standardError = calculateStandardError(values);
  const confidenceInterval = calculateConfidenceInterval(values, confidenceLevel);
  const predictiveRange = calculatePredictiveRange(values, confidenceLevel);
  
  return {
    mean,
    median,
    standardDeviation,
    standardError,
    sampleSize: values.length,
    confidenceInterval,
    predictiveRange
  };
}

/**
 * Calculate accuracy with confidence interval
 * For estimation accuracy calculations
 */
export function calculateAccuracyWithConfidence(
  actualValues: number[],
  expectedValues: number[],
  confidenceLevel: number = 95
): {
  accuracy: number;
  confidenceInterval: ConfidenceInterval;
  sampleSize: number;
} {
  if (actualValues.length !== expectedValues.length || actualValues.length === 0) {
    return {
      accuracy: 0,
      confidenceInterval: { lower: 0, upper: 0, confidence: confidenceLevel },
      sampleSize: 0
    };
  }
  
  // Calculate accuracy percentages for each pair
  const accuracyPercentages = actualValues.map((actual, index) => {
    const expected = expectedValues[index];
    if (expected === 0) return 0;
    
    const deviation = Math.abs(actual - expected) / expected;
    return Math.max(0, Math.min(100, (1 - deviation) * 100));
  });
  
  const meanAccuracy = calculateMean(accuracyPercentages);
  const confidenceInterval = calculateConfidenceInterval(accuracyPercentages, confidenceLevel);
  
  return {
    accuracy: Math.round(meanAccuracy * 10) / 10,
    confidenceInterval: {
      lower: Math.round(confidenceInterval.lower * 10) / 10,
      upper: Math.round(confidenceInterval.upper * 10) / 10,
      confidence: confidenceLevel
    },
    sampleSize: actualValues.length
  };
}

/**
 * Format confidence interval for display
 */
export function formatConfidenceInterval(ci: ConfidenceInterval, unit: string = ''): string {
  const lowerFormatted = Math.round(ci.lower * 10) / 10;
  const upperFormatted = Math.round(ci.upper * 10) / 10;
  return `${lowerFormatted}${unit} - ${upperFormatted}${unit} (${ci.confidence}% confidence)`;
}

/**
 * Format predictive range for display
 */
export function formatPredictiveRange(pr: PredictiveRange, unit: string = ''): string {
  const minFormatted = Math.round(pr.minValue * 10) / 10;
  const maxFormatted = Math.round(pr.maxValue * 10) / 10;
  const expectedFormatted = Math.round(pr.expectedValue * 10) / 10;
  return `Expected: ${expectedFormatted}${unit}, Range: ${minFormatted}${unit} - ${maxFormatted}${unit}`;
}