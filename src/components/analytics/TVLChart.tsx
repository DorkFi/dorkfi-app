import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { dorkfiAPIService } from '@/services/dorkfiAPIService';
import { formatCurrency, formatChartDate } from '@/utils/analyticsUtils';
import { useTheme } from 'next-themes';

interface TVLDataPoint {
  date: string;
  total: number;
  weth: number;
  usdc: number;
  usdt: number;
  wbtc: number;
}

const TVLChart = () => {
  const { theme } = useTheme();
  const [tvlData, setTvlData] = useState<TVLDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTVLData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const days = 90; // Fixed to 90 days
        const startTime = now - (days * 24 * 60 * 60 * 1000);
        
        // Always use total (no network filter)
        const networkFilter = undefined;
        const response = await dorkfiAPIService.getTVLGrowth(
          startTime,
          now,
          'day',
          networkFilter
        );

        if (response.success && response.data?.dataPoints) {
          const dataPoints = response.data.dataPoints;
          if (dataPoints.length > 0) {
            // Extract TVL values based on network filter, matching demo page logic
            const transformed: TVLDataPoint[] = dataPoints
              .map((point: any) => {
                // When showing total, use the 'tvl' field from dataPoint (matches demo page)
                const tvlValue = point.tvl || point.value || 0;
                
                return {
                  date: new Date(point.timestamp).toISOString().split('T')[0],
                  total: tvlValue,
                  // Placeholder asset breakdowns - would need asset-specific endpoints for accurate data
                  weth: tvlValue * 0.35,
                  usdc: tvlValue * 0.28,
                  usdt: tvlValue * 0.22,
                  wbtc: tvlValue * 0.15,
                };
              })
              .filter((point) => point.total >= 0); // Allow 0 values but filter out negative
            
            setTvlData(transformed);
          } else {
            setTvlData([]);
          }
        } else {
          console.warn('TVL growth API returned unsuccessful response');
          setTvlData([]);
        }
      } catch (error) {
        console.error('Error fetching TVL growth data:', error);
        setTvlData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTVLData();
  }, []);

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

