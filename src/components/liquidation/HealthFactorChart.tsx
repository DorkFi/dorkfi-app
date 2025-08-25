import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface HealthFactorData {
  range: string;
  count: number;
  fill: string;
}

interface HealthFactorChartProps {
  data: HealthFactorData[];
}

export default function HealthFactorChart({ data }: HealthFactorChartProps) {
  // Use design system colors - matching the exact colors from LiquidationMarkets.tsx
  const getDesignSystemColor = (range: string) => {
    switch (range) {
      case '0-1.0':
        return '#ef4444'; // red-500 for liquidatable
      case '1.0-1.1':
        return '#f97316'; // orange-500 for danger zone
      case '1.1-1.2':
        return '#eab308'; // yellow-500 for moderate
      case '>1.2':
        return '#22c55e'; // green-500 for safe harbor
      default:
        return '#22c55e'; // green-500 as fallback
    }
  };

  const chartData = data.map(item => ({
    ...item,
    fill: getDesignSystemColor(item.range)
  }));

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md card-hover hover:border-ocean-teal/40 transition-all">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-white">Health Factor Analysis</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-2">
                  <p>Distribution of accounts by health factor ranges:</p>
                  <div className="text-sm space-y-1">
                    <div>• <span className="text-red-400">0-1.0:</span> Immediately liquidatable</div>
                    <div>• <span className="text-orange-400">1.0-1.1:</span> High liquidation risk</div>
                    <div>• <span className="text-yellow-400">1.1-1.2:</span> Moderate risk</div>
                    <div>• <span className="text-green-400">{'>'}1.2:</span> Low risk, well-collateralized</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-slate-600" />
                <XAxis 
                  dataKey="range" 
                  className="fill-slate-600 dark:fill-slate-300"
                />
                <YAxis 
                  className="fill-slate-600 dark:fill-slate-300"
                />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
    </Card>
  );
}
