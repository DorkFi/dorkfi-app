
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Shield, AlertTriangle, Zap } from 'lucide-react';

interface RiskZone {
  name: string;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  range: string;
}

interface RiskDistributionBarProps {
  totalAccounts: number;
  liquidatable: number;
  dangerZone: number;
  moderate: number;
  safe: number;
}

export default function RiskDistributionBar({
  totalAccounts,
  liquidatable,
  dangerZone,
  moderate,
  safe
}: RiskDistributionBarProps) {
  const riskZones: RiskZone[] = [
    {
      name: 'Liquidatable',
      count: liquidatable,
      percentage: (liquidatable / totalAccounts) * 100,
      color: 'text-destructive',
      bgColor: 'bg-destructive',
      icon: Zap,
      description: 'Positions that can be liquidated immediately',
      range: '< 1.0'
    },
    {
      name: 'Danger Zone',
      count: dangerZone,
      percentage: (dangerZone / totalAccounts) * 100,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500',
      icon: AlertTriangle,
      description: 'High risk of liquidation within 24 hours',
      range: '1.0 - 1.1'
    },
    {
      name: 'Moderate Risk',
      count: moderate,
      percentage: (moderate / totalAccounts) * 100,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500',
      icon: AlertTriangle,
      description: 'Positions requiring monitoring',
      range: '1.1 - 1.5'
    },
    {
      name: 'Safe Harbor',
      count: safe,
      percentage: (safe / totalAccounts) * 100,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500',
      icon: Shield,
      description: 'Well-collateralized positions',
      range: '> 1.5'
    }
  ];

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md mb-8">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-xl font-semibold text-slate-800 dark:text-white">
            Borrower Health Factor Distribution
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Distribution of borrower positions by health factor ranges</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Main Progress Bar */}
          <div className="relative">
            <div className="flex h-8 bg-muted rounded-lg overflow-hidden">
              {riskZones.map((zone, index) => (
                <Tooltip key={zone.name}>
                  <TooltipTrigger asChild>
                    <div
                      className={`${zone.bgColor} transition-all duration-300 hover:opacity-80 cursor-pointer`}
                      style={{ width: `${zone.percentage}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-semibold">{zone.name}</p>
                      <p className="text-sm">{zone.description}</p>
                      <p className="text-xs">Range: {zone.range}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Zone Details */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {riskZones.map((zone) => {
              const Icon = zone.icon;
              return (
                <div
                  key={zone.name}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${zone.bgColor}/10`}>
                    <Icon className={`h-4 w-4 ${zone.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{zone.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold text-foreground">{zone.count}</p>
                      <Badge variant="outline" className="text-xs">
                        {zone.percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
