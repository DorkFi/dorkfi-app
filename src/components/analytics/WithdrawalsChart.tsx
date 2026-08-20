import React, { useState, useEffect } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';
import { dorkfiAPIService } from '@/services/dorkfiAPIService';
import { fetchAnalyticsMarketUsdLookup } from '@/services/analyticsProtocolTvl';
import {
  activityRowToUsd,
  pickWithdrawValueUsd,
} from '@/utils/analyticsActivityUsd';
import { useTheme } from 'next-themes';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface WithdrawalsDataPoint {
  date: string;
  amount: number;
}

type TimePeriod = '7d' | '30d' | '90d';

const WithdrawalsChart = () => {
  const { theme } = useTheme();
  const [withdrawalsData, setWithdrawalsData] = useState<WithdrawalsDataPoint[]>([]);
  const [totalWithdrawals, setTotalWithdrawals] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('90d');

  useEffect(() => {
    const fetchWithdrawalsData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const days = timePeriod === '7d' ? 7 : timePeriod === '30d' ? 30 : 90;
        const startTime = now - (days * 24 * 60 * 60 * 1000);
        
        // Always use total (no network filter)
        const networkFilter = undefined;
        const [response, marketUsdLookup] = await Promise.all([
          dorkfiAPIService.getWithdrawals(
            startTime,
            now,
            10000,
            networkFilter
          ),
          fetchAnalyticsMarketUsdLookup().catch((error) => {
            console.warn('Withdrawals market USD lookup failed', error);
            return new Map();
          }),
        ]);

        if (response.success && response.data?.withdrawals) {
          const withdrawals = response.data.withdrawals;
          if (withdrawals.length > 0) {
            // Group by date and sum amounts (matching demo page approach)
            const dailyWithdrawals: { [key: string]: number } = {};
            
            withdrawals.forEach((withdrawal) => {
              const date = new Date(withdrawal.timestamp).toISOString().split('T')[0];
              const value = activityRowToUsd(
                {
                  amount: withdrawal.amount,
                  valueUsd: pickWithdrawValueUsd(withdrawal),
                  network: withdrawal.network,
                  marketId: withdrawal.marketId,
                },
                marketUsdLookup
              );
              dailyWithdrawals[date] = (dailyWithdrawals[date] || 0) + value;
            });

            const transformed = Object.entries(dailyWithdrawals)
              .map(([date, amount]) => ({ date, amount }))
              .sort((a, b) => a.date.localeCompare(b.date));
            
            setWithdrawalsData(transformed);
            
            // Sum normalized rows. Withdrawal summaries are still mixed-scale vs deposits.
            setTotalWithdrawals(
              transformed.reduce((sum, d) => sum + d.amount, 0)
            );
          } else {
            setWithdrawalsData([]);
            setTotalWithdrawals(0);
          }
        } else {
          console.warn('Withdrawals API returned unsuccessful response');
          setWithdrawalsData([]);
          setTotalWithdrawals(0);
        }
      } catch (error) {
        console.error('Error fetching withdrawals data:', error);
        setWithdrawalsData([]);
        setTotalWithdrawals(0);
      } finally {
        setLoading(false);
      }
    };

    fetchWithdrawalsData();
  }, [timePeriod]);

  const formattedTotal = totalWithdrawals >= 1_000_000 
    ? `$${(totalWithdrawals / 1_000_000).toFixed(1)}M`
    : totalWithdrawals >= 1_000
    ? `$${(totalWithdrawals / 1_000).toFixed(1)}K`
    : `$${totalWithdrawals.toFixed(2)}`;

  const chartData = withdrawalsData.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    amount: d.amount, // Use raw dollar amounts
  }));

  // Calculate max value and set Y-axis domain to 1.1x max
  const maxValue = chartData.length > 0 
    ? Math.max(...chartData.map(d => d.amount))
    : 0;
  const yAxisDomain = [0, maxValue * 1.1 || 5000]; // Default to 5000 if no data

  if (loading) {
    return (
      <ChartCard 
        title="Withdrawals" 
        subtitle="Total withdrawals: Loading..."
        tooltip="Monitor daily withdrawal activity to track user outflows and liquidity patterns"
      >
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard 
      title="Withdrawals" 
      subtitle={`Total withdrawals: ${formattedTotal}`}
      tooltip="Monitor daily withdrawal activity to track user outflows and liquidity patterns"
      controls={
        <ToggleGroup 
          type="single" 
          value={timePeriod} 
          onValueChange={(value) => value && setTimePeriod(value as TimePeriod)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="7d" aria-label="7 days">7d</ToggleGroupItem>
          <ToggleGroupItem value="30d" aria-label="30 days">30d</ToggleGroupItem>
          <ToggleGroupItem value="90d" aria-label="90 days">90d</ToggleGroupItem>
        </ToggleGroup>
      }
    >
      {withdrawalsData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(226, 232, 240)'} />
            <defs>
              <linearGradient id="withdrawalsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--whale-gold))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--whale-gold))" stopOpacity={0}/>
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
                return [formatted, 'Withdrawals'];
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="hsl(var(--whale-gold))"
              strokeWidth={2}
              fill="url(#withdrawalsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No withdrawal data available for this period.
        </div>
      )}
    </ChartCard>
  );
};

export default WithdrawalsChart;

