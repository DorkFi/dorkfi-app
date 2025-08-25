
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TokenData {
  symbol: string;
  name: string;
  icon: string;
  value: number;
  count: number;
  successRate: number;
  change24h: number;
  lastLiquidation: string;
  borrowPoolPercentage: number;
}

interface TokenStatsPanelProps {
  selectedToken: TokenData | null;
  className?: string;
}

export default function TokenStatsPanel({ selectedToken, className }: TokenStatsPanelProps) {
  const formatLiquidationVolume = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const getSuccessRateBadgeVariant = (rate: number) => {
    if (rate >= 90) return 'default';
    if (rate >= 75) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className={`bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-lg hover:shadow-xl transition-all duration-300 h-full ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">
          Token Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedToken ? (
          <>
            {/* Token Header */}
            <div className="flex items-center gap-3">
              <img 
                src={selectedToken.icon} 
                alt={selectedToken.symbol} 
                className="w-10 h-10 rounded-full border-2 border-ocean-teal/20"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
              <div>
                <h3 className="font-semibold text-lg text-slate-800 dark:text-white">
                  {selectedToken.symbol}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedToken.name}
                </p>
              </div>
            </div>

            {/* Liquidation Volume */}
            <div className="bg-white/30 dark:bg-slate-800/30 rounded-lg p-4 border border-gray-200/30 dark:border-ocean-teal/10">
              <p className="text-sm text-muted-foreground mb-1">Liquidation Volume</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {formatLiquidationVolume(selectedToken.value)}
              </p>
              <p className={`text-sm font-medium ${selectedToken.change24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {selectedToken.change24h >= 0 ? '+' : ''}{selectedToken.change24h.toFixed(1)}% (24h)
              </p>
            </div>

            {/* Stats Grid */}
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200/30 dark:border-ocean-teal/10">
                <span className="text-sm text-muted-foreground">Liquidation Events</span>
                <span className="font-semibold text-slate-800 dark:text-white">
                  {selectedToken.count}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-200/30 dark:border-ocean-teal/10">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <Badge 
                  variant={getSuccessRateBadgeVariant(selectedToken.successRate)}
                  className="text-xs"
                >
                  {selectedToken.successRate.toFixed(1)}%
                </Badge>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-200/30 dark:border-ocean-teal/10">
                <span className="text-sm text-muted-foreground">Pool Share</span>
                <span className="font-semibold text-slate-800 dark:text-white">
                  {selectedToken.borrowPoolPercentage.toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Last Liquidation</span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {selectedToken.lastLiquidation}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-ocean-teal/20 to-ocean-teal/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-ocean-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Select a token to view stats
            </p>
            <p className="text-xs text-muted-foreground">
              Click on a bubble to explore liquidation data
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
