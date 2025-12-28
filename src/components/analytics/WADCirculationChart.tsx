import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { dorkfiAPIService } from '@/services/dorkfiAPIService';
import { formatCurrency, formatChartDate } from '@/utils/analyticsUtils';
import { useTheme } from 'next-themes';

interface WADDataPoint {
  date: string;
  supply: number;
}

const WADCirculationChart = () => {
  const { theme } = useTheme();
  const [wadData, setWadData] = useState<WADDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWADData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const days = 90; // Fixed to 90 days
        const startTime = now - (days * 24 * 60 * 60 * 1000);
        
        // Always use total (no network filter)
        const networkFilter = undefined;
        const response = await dorkfiAPIService.getWADSupplyGrowth(
          startTime,
          now,
          'day',
          networkFilter
        );

        if (response.success && response.data?.dataPoints) {
          const dataPoints = response.data.dataPoints;
          if (dataPoints.length > 0) {
            // Extract WAD supply values for total, matching demo page logic
            const transformed: WADDataPoint[] = dataPoints
              .map((point: any) => {
                // When showing total, use the 'supply' field from dataPoint
                // Normalize WAD by dividing by 10^6 (1e6)
                const rawValue = parseFloat(point.supply || point.value || '0');
                const supplyValue = rawValue / 1e6;
                
                return {
                  date: new Date(point.timestamp).toISOString().split('T')[0],
                  supply: supplyValue,
                };
              })
              .filter((point) => point.supply >= 0); // Allow 0 values but filter out negative
            
            setWadData(transformed);
          } else {
            setWadData([]);
          }
        } else {
          console.warn('WAD supply growth API returned unsuccessful response');
          setWadData([]);
        }
      } catch (error) {
        console.error('Error fetching WAD supply growth data:', error);
        setWadData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWADData();
  }, []);

  if (loading) {
    return (
      <ChartCard title="WAD Supply Growth">
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
          <p className="text-sm text-ocean-teal">
            Supply: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };


  return (
    <ChartCard 
      title="WAD Supply Growth" 
      tooltip="Shows the WAD supply growth over time."
    >
      {wadData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={wadData}>
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
              dataKey="supply" 
              stroke="hsl(var(--ocean-teal))" 
              strokeWidth={3}
              name="WAD Supply"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No WAD supply data available for this period.
        </div>
      )}
    </ChartCard>
  );
};

export default WADCirculationChart;

