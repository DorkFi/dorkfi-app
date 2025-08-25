
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertTriangle, Activity } from 'lucide-react';

interface VerticalSummaryCardsProps {
  totalLiquidated24h: number;
  atRiskWallets: number;
  activeLiquidationEvents: number;
}

export default function VerticalSummaryCards({ 
  totalLiquidated24h, 
  atRiskWallets, 
  activeLiquidationEvents 
}: VerticalSummaryCardsProps) {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  const metrics = [
    {
      title: "Total Liquidated (24h)",
      value: formatCurrency(totalLiquidated24h),
      icon: DollarSign,
      color: "bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/20",
      iconColor: "text-red-500 dark:text-red-400",
      trend: "+12.5%",
      trendColor: "text-red-500",
      glowColor: "shadow-red-500/20"
    },
    {
      title: "At-Risk Wallets",
      value: atRiskWallets.toLocaleString(),
      icon: AlertTriangle,
      color: "bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-500/20",
      iconColor: "text-amber-500 dark:text-amber-400",
      trend: "+8.2%",
      trendColor: "text-amber-500",
      glowColor: "shadow-amber-500/20"
    },
    {
      title: "Active Liquidation Events",
      value: activeLiquidationEvents.toLocaleString(),
      icon: Activity,
      color: "bg-gradient-to-br from-ocean-teal/10 to-ocean-teal/20 border-ocean-teal/30",
      iconColor: "text-ocean-teal dark:text-ocean-teal",
      trend: "Live",
      trendColor: "text-ocean-teal",
      glowColor: "shadow-ocean-teal/20"
    }
  ];

  return (
    <div className="space-y-2 h-full flex flex-col justify-center">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card 
            key={metric.title}
            className={`${metric.color} border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:${metric.glowColor} animate-fade-in flex-1`}
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <CardContent className="p-3 h-full flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-xl ${metric.color} border`}>
                  <Icon className={`h-5 w-5 ${metric.iconColor}`} />
                </div>
                <Badge 
                  variant="outline" 
                  className={`${metric.trendColor} border-current text-xs`}
                >
                  {metric.trend}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {metric.title}
                </p>
                <p className="text-xl font-bold text-foreground leading-none">
                  {metric.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
