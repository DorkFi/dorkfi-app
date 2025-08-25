import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface RiskDistributionData {
  name: string;
  value: number;
  color: string;
}

interface RiskDistributionChartProps {
  data: RiskDistributionData[];
}

export default function RiskDistributionChart({ data }: RiskDistributionChartProps) {
  // Use design system colors - matching the exact colors from LiquidationMarkets.tsx
  const getDesignSystemColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'liquidatable':
        return '#ef4444'; // red-500
      case 'danger zone':
        return '#f97316'; // orange-500
      case 'moderate':
        return '#eab308'; // yellow-500
      case 'safe harbor':
        return '#22c55e'; // green-500
      default:
        return '#22c55e'; // green-500 as fallback
    }
  };

  const chartData = data.map(item => ({
    ...item,
    color: getDesignSystemColor(item.name)
  }));

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md card-hover hover:border-ocean-teal/40 transition-all">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-white">Risk Distribution</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-2">
                  <p>Distribution of accounts by liquidation risk level:</p>
                  <div className="text-sm space-y-1">
                    <div>• <span className="text-red-400">Liquidatable:</span> Health Factor ≤ 1.0</div>
                    <div>• <span className="text-orange-400">Danger Zone:</span> Health Factor 1.0-1.1</div>
                    <div>• <span className="text-yellow-400">Moderate:</span> Health Factor 1.1-1.2</div>
                    <div>• <span className="text-green-400">Safe Harbor:</span> Health Factor {'>'}= 1.2</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend 
                  wrapperStyle={{ color: 'inherit' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
    </Card>
  );
}
