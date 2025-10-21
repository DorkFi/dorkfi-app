
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertTriangle, Activity } from 'lucide-react';

interface LiquidationSummaryBannerProps {
  totalLiquidated24h: number;
  atRiskWallets: number;
  activeLiquidationEvents: number; // This now represents total active wallets
}

export default function LiquidationSummaryBanner({ 
  totalLiquidated24h, 
  atRiskWallets, 
  activeLiquidationEvents 
}: LiquidationSummaryBannerProps) {
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
      color: "bg-gradient-to-r from-red-500/10 to-red-600/10 border-red-500/20",
      iconColor: "text-red-500 dark:text-red-400",
      trend: "+12.5%",
      trendColor: "text-red-500"
    },
    {
      title: "At-Risk Wallets",
      value: atRiskWallets.toLocaleString(),
      icon: AlertTriangle,
      color: "bg-gradient-to-r from-amber-500/10 to-amber-600/10 border-amber-500/20",
      iconColor: "text-amber-500 dark:text-amber-400",
      trend: "+8.2%",
      trendColor: "text-amber-500"
    },
    {
      title: "Total Active Wallets",
      value: activeLiquidationEvents.toLocaleString(),
      icon: Activity,
      color: "bg-gradient-to-r from-ocean-teal/10 to-ocean-teal/20 border-ocean-teal/30",
      iconColor: "text-ocean-teal dark:text-ocean-teal",
      trend: "Live",
      trendColor: "text-ocean-teal"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card 
            key={metric.title}
            className={`${metric.color} border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg animate-fade-in`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${metric.color} border`}>
                    <Icon className={`h-6 w-6 ${metric.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      {metric.title}
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {metric.value}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant="outline" 
                    className={`${metric.trendColor} border-current`}
                  >
                    {metric.trend}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
