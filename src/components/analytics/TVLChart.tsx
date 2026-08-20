import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { dorkfiAPIService } from '@/services/dorkfiAPIService';
import { fetchOracleBasedProtocolTotals, peekCachedOracleProtocolTotals } from '@/services/analyticsProtocolTvl';
import { formatCurrency, formatChartDate } from '@/utils/analyticsUtils';
import {
  overlayLiveTvlOnSeries,
  tvlFromGrowthDataPoint,
} from '@/utils/analyticsProtocolTvl';
import { useTheme } from 'next-themes';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface TVLDataPoint {
  date: string;
  total: number;
  weth: number;
  usdc: number;
  usdt: number;
  wbtc: number;
}

type TimePeriod = '7d' | '30d' | '90d';

const TVLChart = () => {
  const { theme } = useTheme();
  const [tvlData, setTvlData] = useState<TVLDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('90d');

  useEffect(() => {
    const fetchTVLData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const days = timePeriod === '7d' ? 7 : timePeriod === '30d' ? 30 : 90;
        const startTime = now - (days * 24 * 60 * 60 * 1000);
        
        const networkFilter = undefined;
        const cachedOracle = peekCachedOracleProtocolTotals();
        const response = await dorkfiAPIService.getTVLGrowth(
          startTime,
          now,
          'day',
          networkFilter
        );

        if (response.success && response.data?.dataPoints) {
          const dataPoints = response.data.dataPoints;
          if (dataPoints.length > 0) {
            const transformed: TVLDataPoint[] = dataPoints
              .map((point: { tvl?: number; value?: number; timestamp: number }) => {
                const tvlValue = tvlFromGrowthDataPoint(point);
                
                return {
                  date: new Date(point.timestamp).toISOString().split('T')[0],
                  total: tvlValue,
                  weth: tvlValue * 0.35,
                  usdc: tvlValue * 0.28,
                  usdt: tvlValue * 0.22,
                  wbtc: tvlValue * 0.15,
                };
              })
              .filter((point) => point.total >= 0);
            
            setTvlData(
              cachedOracle?.tvl
                ? overlayLiveTvlOnSeries(transformed, cachedOracle.tvl)
                : transformed
            );
          } else {
            setTvlData([]);
          }
        } else {
          console.warn('TVL growth API returned unsuccessful response');
          setTvlData([]);
        }

        if (!cachedOracle) {
          fetchOracleBasedProtocolTotals()
            .then((oracleTotals) => {
              if (!oracleTotals?.tvl) return;
              setTvlData((prev) =>
                prev.length > 0
                  ? overlayLiveTvlOnSeries(prev, oracleTotals.tvl)
                  : prev
              );
            })
            .catch((error) => {
              console.warn('[TVLChart] oracle overlay failed', error);
            });
        }
      } catch (error) {
        console.error('Error fetching TVL growth data:', error);
        setTvlData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTVLData();
  }, [timePeriod]);

  // Calculate min and max values from the data
  const yAxisDomain = React.useMemo(() => {
    if (tvlData.length === 0) return ['auto', 'auto'];
    
    const values = tvlData.map(point => point.total);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Set y-axis to 0.95 * min and 1.05 * max for better visualization
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

