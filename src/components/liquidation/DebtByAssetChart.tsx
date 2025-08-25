import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { 
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getTokenImagePath } from '@/utils/tokenImageUtils';

interface DebtData {
  asset: string;
  value: number;
  percentage: number;
  color: string;
  image: string;
}

const mockDebtData: DebtData[] = [
  { asset: 'aVOI', value: 12450000, percentage: 45.2, color: 'hsl(var(--ocean-teal))', image: getTokenImagePath('aVOI') },
  { asset: 'aUSDC', value: 8230000, percentage: 29.8, color: 'hsl(var(--highlight-aqua))', image: getTokenImagePath('aUSDC') },
  { asset: 'aUNIT', value: 4120000, percentage: 14.9, color: 'hsl(var(--sky-blue))', image: getTokenImagePath('aUNIT') },
  { asset: 'aBTC', value: 2780000, percentage: 10.1, color: 'hsl(var(--whale-gold))', image: getTokenImagePath('aBTC') },
];

type ViewMode = 'percentage' | 'value';

const CustomTooltip = ({ active, payload, viewMode }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <img src={data.image} alt={data.asset} className="w-6 h-6 rounded-full" />
          <p className="font-semibold">{data.asset}</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {viewMode === 'percentage' ? `${data.percentage}%` : `$${data.value.toLocaleString()}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {viewMode === 'percentage' ? `$${data.value.toLocaleString()}` : `${data.percentage}%`}
        </p>
      </div>
    );
  }
  return null;
};

export default function DebtByAssetChart() {
  const [viewMode, setViewMode] = useState<ViewMode>('percentage');

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-gray-200/50 dark:border-ocean-teal/20 shadow-md hover:shadow-lg card-hover transition-all">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg font-semibold">
                Debt by Asset
              </CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View the share of total outstanding loans across all assets</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              View the share of total outstanding loans across all assets.
            </p>
          </div>
          <Badge variant="outline" className="bg-ocean-teal/10 border-ocean-teal/20 text-ocean-teal">
            Live
          </Badge>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === 'percentage' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('percentage')}
            className="flex-1 text-xs"
          >
            % of Total
          </Button>
          <Button
            variant={viewMode === 'value' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('value')}
            className="flex-1 text-xs"
          >
            USD Value
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={mockDebtData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey={viewMode === 'percentage' ? 'percentage' : 'value'}
                animationBegin={0}
                animationDuration={400}
              >
                {mockDebtData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                  />
                ))}
              </Pie>
              <Tooltip 
                content={(props) => <CustomTooltip {...props} viewMode={viewMode} />}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t">
          {mockDebtData.map((item) => (
            <div key={item.asset} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <img 
                src={item.image} 
                alt={item.asset}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-sm font-medium">
                {item.asset}
              </span>
              <span className="text-sm text-muted-foreground ml-auto">
                {viewMode === 'percentage' ? `${item.percentage}%` : `$${(item.value / 1000000).toFixed(1)}M`}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}