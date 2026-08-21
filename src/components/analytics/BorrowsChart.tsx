import React, { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';
import { useActivityDailySeries } from '@/hooks/useCachedAnalyticsSeries';
import { type AnalyticsTimePeriod } from '@/utils/analyticsTimePeriod';
import { useTheme } from 'next-themes';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const BorrowsChart = () => {
  const { theme } = useTheme();
  const [timePeriod, setTimePeriod] = useState<AnalyticsTimePeriod>('90d');
  const { series: borrowsData, loading, total: totalBorrows } =
    useActivityDailySeries('borrows', timePeriod);

  const formattedTotal = totalBorrows >= 1_000_000 
    ? `$${(totalBorrows / 1_000_000).toFixed(1)}M`
    : totalBorrows >= 1_000
    ? `$${(totalBorrows / 1_000).toFixed(1)}K`
    : `$${totalBorrows.toFixed(2)}`;

  const chartData = borrowsData.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    amount: d.amount,
  }));

  const maxValue = chartData.length > 0 
    ? Math.max(...chartData.map(d => d.amount))
    : 0;
  const yAxisDomain = [0, maxValue * 1.1 || 5000];

  if (loading) {
    return (
      <ChartCard 
        title="Borrows" 
        subtitle="Total borrows: Loading..."
        tooltip="Track daily borrowing activity to monitor lending demand and protocol utilization"
      >
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard 
      title="Borrows" 
      subtitle={`Total borrows: ${formattedTotal}`}
      tooltip="Track daily borrowing activity to monitor lending demand and protocol utilization"
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
      {borrowsData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(226, 232, 240)'} />
            <defs>
              <linearGradient id="borrowsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(236, 72, 153)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="rgb(236, 72, 153)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => {
                if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
                if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
                return `$${value.toFixed(0)}`;
              }}
              domain={yAxisDomain}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => {
                const formatted = value >= 1_000_000 
                  ? `$${(value / 1_000_000).toFixed(2)}M`
                  : value >= 1_000
                  ? `$${(value / 1_000).toFixed(2)}K`
                  : `$${value.toFixed(2)}`;
                return [formatted, 'Borrows'];
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="rgb(236, 72, 153)"
              strokeWidth={2}
              fill="url(#borrowsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No borrow data available for this period.
        </div>
      )}
    </ChartCard>
  );
};

export default BorrowsChart;
