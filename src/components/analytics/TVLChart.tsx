import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { useTvlGrowthSeries } from '@/hooks/useCachedAnalyticsSeries';
import { formatCurrency, formatChartDate } from '@/utils/analyticsUtils';
import { type AnalyticsTimePeriod } from '@/utils/analyticsTimePeriod';
import { useTheme } from 'next-themes';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const TVLChart = () => {
  const { theme } = useTheme();
  const [timePeriod, setTimePeriod] = useState<AnalyticsTimePeriod>('90d');
  const { series: tvlData, loading } = useTvlGrowthSeries(timePeriod);

  const yAxisDomain = React.useMemo(() => {
    if (tvlData.length === 0) return ['auto', 'auto'];
    
    const values = tvlData.map(point => point.total);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return [min * 0.95, max * 1.05];
  }, [tvlData]);

  if (loading) {
    return (
      <ChartCard title="TVL Growth">
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading chart...</div>
        </div>
      </ChartCard>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{formatChartDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ChartCard 
      title="TVL Growth" 
      tooltip="Shows the total value locked in the protocol over time."
      controls={
        <ToggleGroup 
          type="single" 
          value={timePeriod} 
          onValueChange={(value) => value && setTimePeriod(value as AnalyticsTimePeriod)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="7d" aria-label="7 days">7d</ToggleGroupItem>
          <ToggleGroupItem value="30d" aria-label="30 days">30d</ToggleGroupItem>
          <ToggleGroupItem value="90d" aria-label="90 days">90d</ToggleGroupItem>
        </ToggleGroup>
      }
    >
      {tvlData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={tvlData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(226, 232, 240)'} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatChartDate(value)}
            />
            <YAxis 
              domain={yAxisDomain}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value, 0)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="hsl(var(--ocean-teal))" 
              strokeWidth={3}
              name="Total TVL"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No TVL data available for this period.
        </div>
      )}
    </ChartCard>
  );
};

export default TVLChart;
