import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartCard from './ChartCard';
import { dorkfiAPIService } from '@/services/dorkfiAPIService';
import { formatCurrency, formatChartDate } from '@/utils/analyticsUtils';
import { useTheme } from 'next-themes';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface WADDataPoint {
  date: string;
  supply: number;
}

type TimePeriod = '7d' | '30d' | '90d';

const WADCirculationChart = () => {
  const { theme } = useTheme();
  const [wadData, setWadData] = useState<WADDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('90d');

  useEffect(() => {
    const fetchWADData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const days = timePeriod === '7d' ? 7 : timePeriod === '30d' ? 30 : 90;
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
  }, [timePeriod]);

  // Calculate min and max values from the data
  const yAxisDomain = React.useMemo(() => {
    if (wadData.length === 0) return ['auto', 'auto'];
    
    const values = wadData.map(point => point.supply);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Set y-axis to 0.95 * min and 1.05 * max for better visualization
    return [min * 0.95, max * 1.05];
  }, [wadData]);

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
              domain={yAxisDomain}
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

