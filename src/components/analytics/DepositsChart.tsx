import React, { useState, useEffect } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';
import { dorkfiAPIService } from '@/services/dorkfiAPIService';
import { useTheme } from 'next-themes';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface DepositsDataPoint {
  date: string;
  amount: number;
}

type TimePeriod = '7d' | '30d' | '90d';

const DepositsChart = () => {
  const { theme } = useTheme();
  const [depositsData, setDepositsData] = useState<DepositsDataPoint[]>([]);
  const [totalDeposits, setTotalDeposits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('90d');

  useEffect(() => {
    const fetchDepositsData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const days = timePeriod === '7d' ? 7 : timePeriod === '30d' ? 30 : 90;
        const startTime = now - (days * 24 * 60 * 60 * 1000);
        
        // Always use total (no network filter)
        const networkFilter = undefined;
        const response = await dorkfiAPIService.getDeposits(
          startTime,
          now,
          10000,
          networkFilter
        );

        if (response.success && response.data?.deposits) {
          const deposits = response.data.deposits;
          if (deposits.length > 0) {
            // Group by date and sum amounts (matching demo page approach)
            const dailyDeposits: { [key: string]: number } = {};
            
            deposits.forEach((deposit: any) => {
              const date = new Date(deposit.timestamp).toISOString().split('T')[0];
              // Convert from micro-units to USD (divide by 1e12, matching demo page)
              const value = parseFloat(deposit.depositValueUSD || '0') / 1e12;
              dailyDeposits[date] = (dailyDeposits[date] || 0) + value;
            });

            const transformed = Object.entries(dailyDeposits)
              .map(([date, amount]) => ({ date, amount }))
              .sort((a, b) => a.date.localeCompare(b.date));
            
            setDepositsData(transformed);
            
            // Calculate total from summary if available, otherwise sum the daily amounts
            const totalFromSummary = response.data.summary?.totalDepositValueUSD 
              ? parseFloat(response.data.summary.totalDepositValueUSD) / 1e12
              : transformed.reduce((sum, d) => sum + d.amount, 0);
            setTotalDeposits(totalFromSummary);
          } else {
            setDepositsData([]);
            setTotalDeposits(0);
          }
        } else {
          console.warn('Deposits API returned unsuccessful response');
          setDepositsData([]);
          setTotalDeposits(0);
        }
      } catch (error) {
        console.error('Error fetching deposits data:', error);
        setDepositsData([]);
        setTotalDeposits(0);
      } finally {
        setLoading(false);
      }
    };

    fetchDepositsData();
  }, [timePeriod]);

  const formattedTotal = totalDeposits >= 1_000_000 
    ? `$${(totalDeposits / 1_000_000).toFixed(1)}M`
    : totalDeposits >= 1_000
    ? `$${(totalDeposits / 1_000).toFixed(1)}K`
    : `$${totalDeposits.toFixed(2)}`;

  const chartData = depositsData.map(d => ({
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
        title="Deposits" 
        subtitle="Total deposits: Loading..."
        tooltip="Track daily deposit volume to monitor user inflows and protocol growth"
      >
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard 
      title="Deposits" 
      subtitle={`Total deposits: ${formattedTotal}`}
      tooltip="Track daily deposit volume to monitor user inflows and protocol growth"
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
      {depositsData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(226, 232, 240)'} />
            <defs>
              <linearGradient id="depositsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--ocean-teal))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--ocean-teal))" stopOpacity={0}/>
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
                return [formatted, 'Deposits'];
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="hsl(var(--ocean-teal))"
              strokeWidth={2}
              fill="url(#depositsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No deposit data available for this period.
        </div>
      )}
    </ChartCard>
  );
};

export default DepositsChart;

