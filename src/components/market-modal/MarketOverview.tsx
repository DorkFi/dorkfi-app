import React from 'react';
import { MarketData } from './types';

const OverviewItem = ({ title, value, subtitle, color }: {
  title: string, value: string, color?: string, subtitle?: string
}) => (
  <div className="flex flex-col items-start bg-[#101c38] rounded-2xl px-4 py-4 min-w-[140px] flex-1 shadow border border-white/5">
    <span className="text-xs text-blue-100/80 mb-1">{title}</span>
    <span className={`font-extrabold text-xl md:text-2xl ${color || 'text-white'} mb-0`}>{value}</span>
    {subtitle && <span className="text-[11px] text-blue-300/70 mt-0.5">{subtitle}</span>}
  </div>
);

const UtilizationBar = ({ percent }: { percent: number }) => (
  <div className="w-full mt-4 mb-1 flex flex-col gap-1">
    <div className="flex flex-row justify-between items-center text-xs text-blue-200/80">
      <span>0%</span>
      <span className="text-yellow-400 font-semibold">Optimal: 80%</span>
      <span>100%</span>
    </div>
    <div className="w-full h-3 rounded-full bg-gradient-to-r from-yellow-400 via-yellow-600/80 to-blue-700/60 relative flex">
      <div style={{ width: `${percent}%` }} className="h-3 rounded-full bg-yellow-400 absolute left-0 top-0 transition-all" />
      <div style={{ left: '80%' }} className="absolute top-0 h-3 w-[2px] bg-white/50" />
    </div>
    <div className="mt-1 text-right text-yellow-400 text-lg font-bold">{percent?.toFixed(1)}%</div>
  </div>
);

export const MarketOverview = ({ marketData }: { marketData: MarketData }) => {
  return (
    <div className="flex flex-wrap gap-4 px-2 mb-2">
      <OverviewItem title="Available Liquidity" value={`$${marketData.availableLiquidity.toLocaleString()}`} color="text-blue-200" subtitle={`${(marketData.availableLiquidity / (marketData.totalSupply || 1) * 100).toFixed(1)}% of supply`} />
      <OverviewItem title="Total Supplied" value={`$${marketData.totalSupply.toLocaleString()}`} color="text-green-400" subtitle={`${marketData.supplyAPY.toFixed(2)}% APY`} />
      <OverviewItem title="Total Borrowed" value={`$${marketData.totalBorrow.toLocaleString()}`} color="text-orange-400" subtitle={`${marketData.borrowAPY.toFixed(2)}% APY`} />
    <div className="flex-1 min-w-[240px]">
      <span className="block text-xs text-blue-100/80 mb-1">Utilization Rate</span>
      <UtilizationBar percent={marketData.utilization ?? 0} />
    </div>
  </div>
  );
};

