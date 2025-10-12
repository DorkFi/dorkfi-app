import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { 
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getTokenImagePath } from '@/utils/tokenImageUtils';
import { useIsMobile } from '@/hooks/use-mobile';

interface UtilizationData {
  asset: string;
  supplied: number;
  borrowed: number;
  utilization: number;
  color: string;
  lightColor: string;
  image: string;
  maxLTV: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
}

const mockUtilizationDataByPeriod: Record<string, UtilizationData[]> = {
  '24h': [
    { 
      asset: 'aVOI', 
      supplied: 28500000, 
      borrowed: 12450000, 
      utilization: 43.7,
      color: 'hsl(var(--ocean-teal))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aVOI'),
      maxLTV: 75,
      liquidationThreshold: 80,
      liquidationPenalty: 5
    },
    { 
      asset: 'aUSDC', 
      supplied: 15200000, 
      borrowed: 8230000, 
      utilization: 54.1,
      color: 'hsl(var(--whale-gold))',
      lightColor: 'hsl(var(--sky-blue))',
      image: getTokenImagePath('aUSDC'),
      maxLTV: 85,
      liquidationThreshold: 90,
      liquidationPenalty: 4
    },
    { 
      asset: 'aUNIT', 
      supplied: 8900000, 
      borrowed: 4120000, 
      utilization: 46.3,
      color: 'hsl(var(--deep-sea-navy))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aUNIT'),
      maxLTV: 70,
      liquidationThreshold: 75,
      liquidationPenalty: 6
    },
    { 
      asset: 'aBTC', 
      supplied: 4200000, 
      borrowed: 2780000, 
      utilization: 66.2,
      color: 'hsl(var(--warning-orange))',
      lightColor: 'hsl(var(--sky-blue))',
      image: getTokenImagePath('aBTC'),
      maxLTV: 80,
      liquidationThreshold: 85,
      liquidationPenalty: 5
    },
    { 
      asset: 'aETH', 
      supplied: 3800000, 
      borrowed: 2280000, 
      utilization: 60.0,
      color: 'hsl(var(--ink-blue))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aETH'),
      maxLTV: 82,
      liquidationThreshold: 87,
      liquidationPenalty: 4.5
    },
  ],
  '7d': [
    { 
      asset: 'aVOI', 
      supplied: 29200000, 
      borrowed: 13100000, 
      utilization: 44.9,
      color: 'hsl(var(--ocean-teal))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aVOI'),
      maxLTV: 75,
      liquidationThreshold: 80,
      liquidationPenalty: 5
    },
    { 
      asset: 'aUSDC', 
      supplied: 16800000, 
      borrowed: 9450000, 
      utilization: 56.3,
      color: 'hsl(var(--whale-gold))',
      lightColor: 'hsl(var(--sky-blue))',
      image: getTokenImagePath('aUSDC'),
      maxLTV: 85,
      liquidationThreshold: 90,
      liquidationPenalty: 4
    },
    { 
      asset: 'aUNIT', 
      supplied: 9400000, 
      borrowed: 4680000, 
      utilization: 49.8,
      color: 'hsl(var(--deep-sea-navy))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aUNIT'),
      maxLTV: 70,
      liquidationThreshold: 75,
      liquidationPenalty: 6
    },
    { 
      asset: 'aBTC', 
      supplied: 4800000, 
      borrowed: 3240000, 
      utilization: 67.5,
      color: 'hsl(var(--warning-orange))',
      lightColor: 'hsl(var(--sky-blue))',
      image: getTokenImagePath('aBTC'),
      maxLTV: 80,
      liquidationThreshold: 85,
      liquidationPenalty: 5
    },
    { 
      asset: 'aETH', 
      supplied: 4100000, 
      borrowed: 2460000, 
      utilization: 60.0,
      color: 'hsl(var(--ink-blue))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aETH'),
      maxLTV: 82,
      liquidationThreshold: 87,
      liquidationPenalty: 4.5
    },
  ],
  '30d': [
    { 
      asset: 'aVOI', 
      supplied: 31200000, 
      borrowed: 15600000, 
      utilization: 50.0,
      color: 'hsl(var(--ocean-teal))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aVOI'),
      maxLTV: 75,
      liquidationThreshold: 80,
      liquidationPenalty: 5
    },
    { 
      asset: 'aUSDC', 
      supplied: 18900000, 
      borrowed: 11340000, 
      utilization: 60.0,
      color: 'hsl(var(--whale-gold))',
      lightColor: 'hsl(var(--sky-blue))',
      image: getTokenImagePath('aUSDC'),
      maxLTV: 85,
      liquidationThreshold: 90,
      liquidationPenalty: 4
    },
    { 
      asset: 'aUNIT', 
      supplied: 10200000, 
      borrowed: 5610000, 
      utilization: 55.0,
      color: 'hsl(var(--deep-sea-navy))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aUNIT'),
      maxLTV: 70,
      liquidationThreshold: 75,
      liquidationPenalty: 6
    },
    { 
      asset: 'aBTC', 
      supplied: 5400000, 
      borrowed: 3780000, 
      utilization: 70.0,
      color: 'hsl(var(--warning-orange))',
      lightColor: 'hsl(var(--sky-blue))',
      image: getTokenImagePath('aBTC'),
      maxLTV: 80,
      liquidationThreshold: 85,
      liquidationPenalty: 5
    },
    { 
      asset: 'aETH', 
      supplied: 4500000, 
      borrowed: 2700000, 
      utilization: 60.0,
      color: 'hsl(var(--ink-blue))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aETH'),
      maxLTV: 82,
      liquidationThreshold: 87,
      liquidationPenalty: 4.5
    },
  ],
  'All': [
    { 
      asset: 'aVOI', 
      supplied: 32800000, 
      borrowed: 16400000, 
      utilization: 50.0,
      color: 'hsl(var(--ocean-teal))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aVOI'),
      maxLTV: 75,
      liquidationThreshold: 80,
      liquidationPenalty: 5
    },
    { 
      asset: 'aUSDC', 
      supplied: 19500000, 
      borrowed: 11700000, 
      utilization: 60.0,
      color: 'hsl(var(--whale-gold))',
      lightColor: 'hsl(var(--sky-blue))',
      image: getTokenImagePath('aUSDC'),
      maxLTV: 85,
      liquidationThreshold: 90,
      liquidationPenalty: 4
    },
    { 
      asset: 'aUNIT', 
      supplied: 11000000, 
      borrowed: 6050000, 
      utilization: 55.0,
      color: 'hsl(var(--deep-sea-navy))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aUNIT'),
      maxLTV: 70,
      liquidationThreshold: 75,
      liquidationPenalty: 6
    },
    { 
      asset: 'aBTC', 
      supplied: 6000000, 
      borrowed: 4200000, 
      utilization: 70.0,
      color: 'hsl(var(--warning-orange))',
      lightColor: 'hsl(var(--sky-blue))',
      image: getTokenImagePath('aBTC'),
      maxLTV: 80,
      liquidationThreshold: 85,
      liquidationPenalty: 5
    },
    { 
      asset: 'aETH', 
      supplied: 5000000, 
      borrowed: 3000000, 
      utilization: 60.0,
      color: 'hsl(var(--ink-blue))',
      lightColor: 'hsl(var(--highlight-aqua))',
      image: getTokenImagePath('aETH'),
      maxLTV: 82,
      liquidationThreshold: 87,
      liquidationPenalty: 4.5
    },
  ],
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const displayAsset = data.asset?.startsWith('a') ? data.asset.slice(1) : data.asset;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <img src={data.image} alt={displayAsset} className="w-6 h-6 rounded-full" />
          <p className="font-semibold">{displayAsset}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Supplied: ${data.supplied.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Borrowed: ${data.borrowed.toLocaleString()}
          </p>
          <p className="text-sm font-medium pt-1 border-t">
            Utilization: {data.utilization.toFixed(2)}%
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// Custom progress bar component for utilization visualization
const UtilizationProgressBar = ({ data }: { data: UtilizationData }) => {
  const isMobile = useIsMobile();
  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);
  const displayAsset = data.asset.startsWith('a') ? data.asset.slice(1) : data.asset;

  const AssetInfoTooltip = () => (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Max LTV:</span>
          <span className="font-medium">{data.maxLTV}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Liquidation Threshold:</span>
          <span className="font-medium">{data.liquidationThreshold}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Liquidation Penalty:</span>
          <span className="font-medium">{data.liquidationPenalty}%</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 w-28 md:w-32 flex-shrink-0 pr-1">
        <img src={data.image} alt={displayAsset} className="w-5 h-5 rounded-full" />
        <span className="text-sm font-medium truncate">{displayAsset}</span>
        <TooltipProvider>
          <UITooltip 
            open={isMobile ? isTooltipOpen : undefined}
            onOpenChange={isMobile ? setIsTooltipOpen : undefined}
          >
            <TooltipTrigger 
              asChild
              onClick={isMobile ? () => setIsTooltipOpen(!isTooltipOpen) : undefined}
            >
              <button className="ml-1 hover:text-primary transition-colors cursor-pointer flex-shrink-0">
                <Info className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="p-0">
              <AssetInfoTooltip />
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>
      </div>
      <div className="flex-1 relative">
        <div className="flex items-center gap-3">
          {/* Progress bar container */}
          <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden relative">
            {/* Borrowed amount (filled portion) */}
            <div 
              className="h-full rounded-lg transition-all duration-500 ease-out"
              style={{ 
                width: `${data.utilization}%`,
                backgroundColor: data.color
              }}
            />
            {/* Utilization percentage label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-white mix-blend-difference">
                {data.utilization.toFixed(2)}%
              </span>
            </div>
          </div>
          {/* Values display */}
          <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap flex-shrink-0">
            ${(data.borrowed / 1000000).toFixed(1)}M / ${(data.supplied / 1000000).toFixed(1)}M
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ProtocolUtilizationChart() {
  const currentData = mockUtilizationDataByPeriod['24h'];

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-gray-200/50 dark:border-ocean-teal/20 shadow-md hover:shadow-lg card-hover transition-all">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg font-semibold">
                Protocol Utilization by Asset
              </CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Borrowed vs Supplied ratios across each lending pool</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Borrowed vs Supplied ratios across each lending pool.
            </p>
            
          </div>
          <Badge variant="outline" className="bg-ocean-teal/10 border-ocean-teal/20 text-ocean-teal">
            Live
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        
        <div className="space-y-2 min-h-[240px]">
          {currentData.map((data) => (
            <UtilizationProgressBar key={data.asset} data={data} />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-8 mt-6 pt-4 border-t">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700" />
            <span className="text-sm text-muted-foreground">Available to Borrow</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-ocean-teal" />
            <span className="text-sm text-muted-foreground">Currently Borrowed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}