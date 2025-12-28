/**
 * Analytics utility functions for formatting and data transformation
 */

/**
 * Format currency values with appropriate suffixes (K, M, B)
 */
export const formatCurrency = (value: number, decimals = 1): string => {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(decimals)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(decimals)}M`;
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(decimals)}K`;
  }
  return `$${value.toFixed(decimals)}`;
};

/**
 * Format large numbers with appropriate suffixes (K, M, B)
 */
export const formatNumber = (value: number, decimals = 1): string => {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(decimals)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(decimals)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
};

/**
 * Format percentage values
 */
export const formatPercentage = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format percentage change with appropriate color indication
 */
export const formatPercentageChange = (value: number, decimals = 1): { 
  formatted: string; 
  isPositive: boolean; 
  isNeutral: boolean;
} => {
  const formatted = `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`;
  return {
    formatted,
    isPositive: value > 0,
    isNeutral: value === 0,
  };
};

/**
 * Calculate percentage change between two values
 */
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Format dates for chart display
 */
export const formatChartDate = (date: string | Date, format: 'short' | 'long' = 'short'): string => {
  const d = new Date(date);
  
  if (format === 'long') {
    return d.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
  
  // Short format: MMM DD
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

/**
 * Format month labels for charts
 */
export const formatMonthLabel = (month: string): string => {
  return month;
};

/**
 * Calculate total from array of objects with value property
 */
export const calculateTotal = (data: Array<{ value: number }>): number => {
  return data.reduce((sum, item) => sum + item.value, 0);
};

/**
 * Calculate utilization rate percentage
 */
export const calculateUtilization = (borrowed: number, supplied: number): number => {
  if (supplied === 0) return 0;
  return (borrowed / supplied) * 100;
};

/**
 * Get color class based on health factor risk level
 */
export const getHealthFactorColor = (healthFactor: number): string => {
  if (healthFactor < 1.0) return 'text-destructive';
  if (healthFactor < 1.1) return 'text-orange-500';
  if (healthFactor < 1.2) return 'text-yellow-500';
  if (healthFactor < 1.5) return 'text-blue-500';
  return 'text-green-500';
};

/**
 * Get risk level label based on health factor
 */
export const getRiskLevel = (healthFactor: number): string => {
  if (healthFactor < 1.0) return 'Liquidatable';
  if (healthFactor < 1.1) return 'High Risk';
  if (healthFactor < 1.2) return 'Medium Risk';
  if (healthFactor < 1.5) return 'Low Risk';
  return 'Safe';
};

/**
 * Convert array data to chart format
 */
export const transformToChartData = <T extends Record<string, any>>(
  data: T[], 
  xKey: keyof T, 
  yKey: keyof T
): Array<{ x: any; y: any }> => {
  return data.map(item => ({
    x: item[xKey],
    y: item[yKey],
  }));
};

/**
 * Calculate moving average for time series data
 */
export const calculateMovingAverage = (
  data: Array<{ value: number }>, 
  windowSize: number
): Array<{ value: number; average: number }> => {
  return data.map((item, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const end = index + 1;
    const window = data.slice(start, end);
    const average = window.reduce((sum, w) => sum + w.value, 0) / window.length;
    
    return {
      ...item,
      average,
    };
  });
};

/**
 * Generate gradient colors for charts
 */
export const generateChartColors = (count: number): string[] => {
  const baseColors = [
    'hsl(var(--ocean-teal))',
    'hsl(var(--whale-gold))',
    'hsl(var(--highlight-aqua))',
    'hsl(var(--accent))',
    'hsl(var(--muted))',
  ];
  
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  
  return colors;
};

/**
 * Format tooltip values for charts
 */
export const formatTooltipValue = (
  value: any, 
  name: string, 
  type: 'currency' | 'number' | 'percentage' = 'number'
): [string, string] => {
  let formattedValue: string;
  
  switch (type) {
    case 'currency':
      formattedValue = formatCurrency(Number(value));
      break;
    case 'percentage':
      formattedValue = formatPercentage(Number(value));
      break;
    default:
      formattedValue = formatNumber(Number(value));
  }
  
  return [formattedValue, name];
};

/**
 * Debounce function for search inputs
 */
export const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Time range aggregation utilities
 */
export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'annual';

interface DataPoint {
  date: string;
  [key: string]: any;
}

/**
 * Get the number of data points to generate based on time range
 */
export const getDataPointCount = (range: TimeRange): number => {
  switch (range) {
    case 'daily': return 30;
    case 'weekly': return 16; // ~4 months
    case 'monthly': return 24; // 2 years
    case 'annual': return 5; // 5 years
    default: return 30;
  }
};

/**
 * Get the time increment in milliseconds based on range
 */
export const getTimeIncrement = (range: TimeRange): number => {
  switch (range) {
    case 'daily': return 24 * 60 * 60 * 1000; // 1 day
    case 'weekly': return 7 * 24 * 60 * 60 * 1000; // 7 days
    case 'monthly': return 30 * 24 * 60 * 60 * 1000; // ~1 month
    case 'annual': return 365 * 24 * 60 * 60 * 1000; // 1 year
    default: return 24 * 60 * 60 * 1000;
  }
};

/**
 * Format date based on time range
 */
export const formatDateForRange = (date: Date | string, range: TimeRange): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  switch (range) {
    case 'daily':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'weekly':
      return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'monthly':
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    case 'annual':
      return d.getFullYear().toString();
    default:
      return formatChartDate(d);
  }
};

/**
 * Aggregate data by week (sum values)
 */
export const aggregateByWeek = <T extends DataPoint>(
  data: T[], 
  valueKeys: string[]
): T[] => {
  if (data.length === 0) return [];
  
  const weeklyData: { [key: string]: any } = {};
  
  data.forEach(item => {
    const date = new Date(item.date);
    // Get Monday of the week
    const monday = new Date(date);
    monday.setDate(date.getDate() - date.getDay() + 1);
    const weekKey = monday.toISOString().split('T')[0];
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { date: weekKey, count: 0 };
      valueKeys.forEach(key => {
        weeklyData[weekKey][key] = 0;
      });
    }
    
    valueKeys.forEach(key => {
      if (typeof item[key] === 'number') {
        weeklyData[weekKey][key] += item[key];
      }
    });
    weeklyData[weekKey].count++;
  });
  
  return Object.values(weeklyData);
};

/**
 * Aggregate data by month (sum values)
 */
export const aggregateByMonth = <T extends DataPoint>(
  data: T[], 
  valueKeys: string[]
): T[] => {
  if (data.length === 0) return [];
  
  const monthlyData: { [key: string]: any } = {};
  
  data.forEach(item => {
    const date = new Date(item.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { date: monthKey, count: 0 };
      valueKeys.forEach(key => {
        monthlyData[monthKey][key] = 0;
      });
    }
    
    valueKeys.forEach(key => {
      if (typeof item[key] === 'number') {
        monthlyData[monthKey][key] += item[key];
      }
    });
    monthlyData[monthKey].count++;
  });
  
  return Object.values(monthlyData);
};

/**
 * Aggregate data by year (sum values)
 */
export const aggregateByYear = <T extends DataPoint>(
  data: T[], 
  valueKeys: string[]
): T[] => {
  if (data.length === 0) return [];
  
  const yearlyData: { [key: string]: any } = {};
  
  data.forEach(item => {
    const date = new Date(item.date);
    const yearKey = `${date.getFullYear()}-01-01`;
    
    if (!yearlyData[yearKey]) {
      yearlyData[yearKey] = { date: yearKey, count: 0 };
      valueKeys.forEach(key => {
        yearlyData[yearKey][key] = 0;
      });
    }
    
    valueKeys.forEach(key => {
      if (typeof item[key] === 'number') {
        yearlyData[yearKey][key] += item[key];
      }
    });
    yearlyData[yearKey].count++;
  });
  
  return Object.values(yearlyData);
};

/**
 * Aggregate data with averaging for certain metrics
 */
export const aggregateWithAverage = <T extends DataPoint>(
  data: T[], 
  range: TimeRange,
  sumKeys: string[] = [],
  avgKeys: string[] = []
): any[] => {
  if (range === 'daily') return data;
  
  const aggregateFn = range === 'weekly' ? aggregateByWeek : 
                      range === 'monthly' ? aggregateByMonth : 
                      aggregateByYear;
  
  const allKeys = [...sumKeys, ...avgKeys];
  const aggregated = aggregateFn(data, allKeys);
  
  // Convert avgKeys to averages
  if (avgKeys.length > 0) {
    aggregated.forEach((item: any) => {
      avgKeys.forEach(key => {
        if (item.count > 0) {
          item[key] = item[key] / item.count;
        }
      });
    });
  }
  
  return aggregated;
};

