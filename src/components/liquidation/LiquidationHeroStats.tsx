
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';

interface HeroStatsProps {
  totalLiquidated24h: number;
  atRiskWallets: number;
  topRiskyAsset: string;
}

export default function LiquidationHeroStats({ 
  totalLiquidated24h, 
  atRiskWallets, 
  topRiskyAsset 
}: HeroStatsProps) {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  const stats = [
    {
      title: "Total Liquidated (24h)",
      value: formatCurrency(totalLiquidated24h),
      icon: DollarSign,
      color: "border-destructive/20 bg-destructive/5",
      iconColor: "text-destructive",
      trend: "+12.5%"
    },
    {
      title: "At-Risk Wallets",
      value: atRiskWallets.toLocaleString(),
      icon: AlertTriangle,
      color: "border-amber-500/20 bg-amber-500/5",
      iconColor: "text-amber-500",
      trend: "+8.2%"
    },
    {
      title: "Top Risky Asset",
      value: topRiskyAsset,
      icon: TrendingUp,
      color: "border-ocean-teal/20 bg-ocean-teal/5",
      iconColor: "text-ocean-teal",
      trend: "68% of risk"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card 
            key={stat.title}
            className={`${stat.color} border-2 transition-all duration-300 hover:scale-105 animate-fade-in`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{stat.trend}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
