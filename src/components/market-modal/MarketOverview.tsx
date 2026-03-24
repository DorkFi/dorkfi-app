import React from 'react';
import { MarketData } from './types';

const OverviewItem = ({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  color?: string;
  subtitle?: string;
}) => (
  <div className="flex flex-col items-start rounded-xl px-3 py-3 sm:px-4 sm:py-4 min-w-0 w-full flex-1 shadow-sm border border-border bg-muted/40 dark:bg-muted/25">
    <span className="text-xs text-muted-foreground mb-1">{title}</span>
    <span className={`font-extrabold text-lg sm:text-xl md:text-2xl break-all ${color || 'text-foreground'} mb-0`}>
      {value}
    </span>
    {subtitle && (
      <span className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</span>
    )}
  </div>
);

const UtilizationBar = ({ percent }: { percent: number }) => (
  <div className="w-full mt-4 mb-1 flex flex-col gap-1">
    <div className="flex flex-row flex-wrap justify-between items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-xs text-muted-foreground">
      <span className="shrink-0">0%</span>
      <span className="text-whale-gold font-semibold text-center min-w-0">Optimal: 80%</span>
      <span className="shrink-0">100%</span>
    </div>
    <div className="w-full h-3 rounded-full bg-muted relative flex overflow-hidden">
      <div
        style={{ width: `${Math.min(100, percent)}%` }}
        className="h-3 rounded-full bg-whale-gold/90 absolute left-0 top-0 transition-all"
      />
      <div
        style={{ left: '80%' }}
        className="absolute top-0 h-3 w-0.5 bg-foreground/30"
      />
    </div>
    <div className="mt-1 text-right text-whale-gold text-lg font-bold">
      {percent?.toFixed(1)}%
    </div>
  </div>
);

export const MarketOverview = ({ marketData }: { marketData: MarketData }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 px-0 mb-0 min-w-0 w-full">
      <OverviewItem
        title="Available liquidity"
        value={`$${marketData.availableLiquidity.toLocaleString()}`}
        color="text-blue-600 dark:text-blue-400"
        subtitle={`${((marketData.availableLiquidity / (marketData.totalSupply || 1)) * 100).toFixed(1)}% of supply`}
      />
      <OverviewItem
        title="Total supplied"
        value={`$${marketData.totalSupply.toLocaleString()}`}
        color="text-green-600 dark:text-green-400"
        subtitle={`${marketData.supplyAPY.toFixed(2)}% APY`}
      />
      <OverviewItem
        title="Total borrowed"
        value={`$${marketData.totalBorrow.toLocaleString()}`}
        color="text-orange-600 dark:text-orange-400"
        subtitle={`${marketData.borrowAPY.toFixed(2)}% APY`}
      />
      <div className="min-w-0 w-full sm:col-span-2">
        <span className="block text-xs text-muted-foreground mb-1">Utilization rate</span>
        <UtilizationBar percent={marketData.utilization ?? 0} />
      </div>
    </div>
  );
};
