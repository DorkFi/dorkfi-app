
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { format } from 'date-fns';

interface OHLCDataPoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

type TimeRange = '1h' | '24h' | '7d';

interface ChartContentProps {
  data: OHLCDataPoint[];
  timeRange: TimeRange;
  isLoading: boolean;
  error: string | null;
  formatPrice: (price: number) => string;
  onRetry: () => void;
  onCandleClick?: (price: number) => void;
}

const ChartContent = ({ data, timeRange, isLoading, error, formatPrice, onRetry, onCandleClick }: ChartContentProps) => {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[450px] gap-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-muted-foreground text-center">{error}</p>
        <Button onClick={onRetry} variant="outline" size="sm">
          Try Again
        </Button>
      </div>
    );
  }

  if (isLoading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[450px]">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-ocean-teal" />
          <span className="text-muted-foreground">Loading chart data...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[450px]">
        <p className="text-muted-foreground">No price data available</p>
      </div>
    );
  }

  // Prepare data for ApexCharts
  const chartData = data.map(item => ({
    x: new Date(item.timestamp),
    y: [item.open, item.high, item.low, item.close]
  }));

  const chartOptions: ApexOptions = {
    chart: {
      type: 'candlestick',
      background: 'transparent',
      toolbar: {
        show: false
      },
      zoom: {
        enabled: true
      },
      events: {
        dataPointSelection: (event, chartContext, config) => {
          if (onCandleClick && config.dataPointIndex >= 0) {
            const dataPoint = data[config.dataPointIndex];
            if (dataPoint) {
              onCandleClick(dataPoint.close);
            }
          }
        }
      }
    },
    theme: {
      mode: 'dark'
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#10b981', // green
          downward: '#ef4444' // red
        },
        wick: {
          useFillColor: true
        }
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: 'hsl(var(--muted-foreground))'
        },
        formatter: (value) => {
          const date = new Date(value);
          return timeRange === '1h' 
            ? format(date, 'HH:mm')
            : timeRange === '24h'
            ? format(date, 'MMM d, HH:mm')
            : format(date, 'MMM d');
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: 'hsl(var(--muted-foreground))'
        },
        formatter: formatPrice
      }
    },
    grid: {
      borderColor: 'hsl(var(--border))',
      strokeDashArray: 3
    },
    tooltip: {
      theme: 'dark',
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const open = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
        const high = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
        const low = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
        const close = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
        const timestamp = w.globals.seriesX[seriesIndex][dataPointIndex];
        
        return `
          <div class="p-3 bg-gray-800 border border-gray-600 rounded">
            <div class="text-sm font-medium mb-2">${format(new Date(timestamp), 'MMM d, yyyy HH:mm')}</div>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between"><span>Open:</span><span>${formatPrice(open)}</span></div>
              <div class="flex justify-between"><span>High:</span><span>${formatPrice(high)}</span></div>
              <div class="flex justify-between"><span>Low:</span><span>${formatPrice(low)}</span></div>
              <div class="flex justify-between"><span>Close:</span><span>${formatPrice(close)}</span></div>
              <div class="text-center mt-2 text-ocean-teal border-t border-gray-600 pt-1">
                💡 Click to trade at ${formatPrice(close)}
              </div>
            </div>
          </div>
        `;
      }
    },
    states: {
      active: {
        allowMultipleDataPointsSelection: false,
        filter: {
          type: 'none'
        }
      }
    }
  };

  return (
    <div className="h-[450px] w-full cursor-pointer">
      <Chart
        options={chartOptions}
        series={[{ data: chartData }]}
        type="candlestick"
        height="100%"
      />
    </div>
  );
};

export default ChartContent;
