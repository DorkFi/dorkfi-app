import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ChartCard from './ChartCard';
import { dorkfiAPIService } from '@/services/dorkfiAPIService';
import { formatNumber } from '@/utils/analyticsUtils';
import { useTheme } from 'next-themes';

interface HealthFactorDataPoint {
  range: string;
  count: number;
  color: string;
}

const HealthFactorChart = () => {
  const { theme } = useTheme();
  const [healthFactorData, setHealthFactorData] = useState<HealthFactorDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealthFactorData = async () => {
      setLoading(true);
      try {
        // Use /user-health endpoint and categorize like demo page (more reliable)
        const baseUrl = import.meta.env.VITE_DORKFI_API_URL || "https://dorkfi-api.nautilus.sh";
        const userHealthResponse = await fetch(`${baseUrl}/user-health`);
        const userHealthData = await userHealthResponse.json();
        
        console.log('User health API response:', userHealthData);

        if (userHealthData.success && userHealthData.data && Array.isArray(userHealthData.data)) {
          // Categorize health factors into ranges (matching demo page approach)
          const ranges: { [key: string]: number } = {
            '<1.0': 0,
            '1.0-1.1': 0,
            '1.1-1.2': 0,
            '1.2-1.5': 0,
            '>1.5': 0,
          };

          userHealthData.data.forEach((user: any) => {
            let hf = user.healthFactor;
            if (hf === null || hf === undefined || isNaN(hf)) return;
            
            // Normalize health factor by dividing by 10000 (matching demo)
            hf = hf / 10000;
            
            if (hf < 1.0) {
              ranges['<1.0']++;
            } else if (hf >= 1.0 && hf < 1.1) {
              ranges['1.0-1.1']++;
            } else if (hf >= 1.1 && hf < 1.2) {
              ranges['1.1-1.2']++;
            } else if (hf >= 1.2 && hf <= 1.5) {
              ranges['1.2-1.5']++;
            } else if (hf > 1.5) {
              ranges['>1.5']++;
            }
          });

          const distribution = Object.entries(ranges).map(([range, count]) => ({
            range,
            count,
          }));

          // Map colors to distribution ranges (matching demo page colors)
          const colorMap: { [key: string]: string } = {
            '<1.0': 'hsl(var(--destructive))', // red
            '1.0-1.1': 'hsl(var(--warning-orange))', // orange
            '1.1-1.2': 'hsl(var(--whale-gold))', // yellow
            '1.2-1.5': 'hsl(var(--highlight-aqua))', // light blue
            '>1.5': 'hsl(var(--ocean-teal))', // teal
          };
          
          const transformed = distribution.map((item) => ({
            range: item.range,
            count: item.count,
            color: colorMap[item.range] || 'hsl(var(--muted))',
          }));
          
          console.log('Transformed health factor data:', transformed);
          setHealthFactorData(transformed);
        } else {
          console.warn('User health API returned unsuccessful response or no data:', userHealthData);
          setHealthFactorData([]);
        }
      } catch (error) {
        console.error('Error fetching health factor data:', error);
        setHealthFactorData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHealthFactorData();
  }, []);

  if (loading) {
    return (
      <ChartCard title="Health Factor Distribution">
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading chart...</div>
        </div>
      </ChartCard>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">Health Factor: {label}</p>
          <p className="text-sm">
            Accounts: {formatNumber(data.count)}
          </p>
          <p className="text-xs text-muted-foreground">
            {label === '<1.0' && 'Liquidatable positions'}
            {label === '1.0-1.1' && 'High risk positions'}
            {label === '1.1-1.2' && 'Medium risk positions'}
            {label === '1.2-1.5' && 'Low risk positions'}
            {label === '>1.5' && 'Safe positions'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartCard 
      title="Health Factor Distribution" 
      subtitle="Borrower risk levels (<1.0 highlighted)"
      tooltip="Distribution of borrower health factors. Values below 1.0 are liquidatable, 1.0-1.1 are high risk, above 1.5 are safe."
      className="h-auto"
    >
      {healthFactorData.length > 0 ? (
        <>
          <div className="h-[220px] sm:h-[260px] mb-4 sm:mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={healthFactorData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgb(30, 41, 59)' : 'rgb(226, 232, 240)'} />
                <XAxis 
                  dataKey="range" 
                  tick={{ fontSize: 10 }}
                  angle={-20}
                  textAnchor="end"
                  height={40}
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => formatNumber(value)}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--ocean-teal))', fillOpacity: 0.15 }} />
                <Bar 
                  dataKey="count" 
                  radius={[4, 4, 0, 0]}
                >
                  {healthFactorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Risk Summary */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
            {healthFactorData.map((item, index) => (
              <div key={index} className="text-center p-1.5 sm:p-2 rounded-lg bg-muted/50">
                <div 
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mx-auto mb-1" 
                  style={{ backgroundColor: item.color }}
                />
                <p className="font-medium">{item.range}</p>
                <p className="text-muted-foreground">{formatNumber(item.count)}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground min-h-[220px]">
          No health factor data available.
        </div>
      )}
    </ChartCard>
  );
};

export default HealthFactorChart;

