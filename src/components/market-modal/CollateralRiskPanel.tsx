import React from 'react';
import { MarketData } from './types';

export const CollateralRiskPanel = ({ marketData }: { marketData: MarketData }) => {
  return (
    <div className="bg-[#151e34] rounded-2xl p-6 mt-6 mb-4 border border-blue-100/5 shadow-md flex flex-col gap-4">
      {/* Title */}
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86a2.37 2.37 0 0 1 3.42 0l6.09 6.37c1.17 1.23.37 3.28-1.34 3.39l-1.4.09a2 2 0 0 0-1.84 2.1l.2 2.08c.13 1.3-1.18 2.28-2.35 1.7l-1.62-.81a2.1 2.1 0 0 0-1.87 0l-1.62.81c-1.17.58-2.48-.4-2.35-1.7l.2-2.08a2 2 0 0 0-1.84-2.1l-1.4-.09c-1.71-.11-2.51-2.16-1.34-3.39l6.09-6.37Z"/></svg>
        <span className="font-semibold text-white text-lg">Collateral & Risk Parameters</span>
      </div>

      {/* Parameters Grid */}
      <div className="grid grid-cols-2 gap-4 mb-2">
        {/* Max LTV */}
        <div className="flex flex-col items-start rounded-xl bg-[#0d172b] p-4 shadow border border-blue-200/10">
          <div className="flex items-center text-blue-200 mb-1">
            <svg className="w-4 h-4 mr-1 text-blue-400" fill="none" viewBox="0 0 24 24"><path d="M17 16v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <span className="text-xs font-medium">Max LTV</span>
          </div>
          <div className="text-2xl font-bold text-white">{marketData.maxLTV}%</div>
        </div>
        {/* Liquidation Threshold */}
        <div className="flex flex-col items-start rounded-xl bg-[#0d172b] p-4 shadow border border-blue-200/10">
          <div className="flex items-center text-blue-200 mb-1">
            <svg className="w-4 h-4 mr-1 text-green-400" fill="none" viewBox="0 0 24 24"><path d="M12 2v20m10-10H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <span className="text-xs font-medium">Liquidation Threshold</span>
          </div>
          <div className="text-2xl font-bold text-white">{marketData.liquidationThreshold}%</div>
        </div>
        {/* Liquidation Bonus */}
        <div className="flex flex-col items-start rounded-xl bg-[#0d172b] p-4 shadow border border-blue-200/10">
          <div className="flex items-center text-blue-200 mb-1">
            <svg className="w-4 h-4 mr-1 text-yellow-400" fill="none" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <span className="text-xs font-medium">Liquidation Bonus</span>
          </div>
          <div className="text-2xl font-bold text-white">{marketData.liquidationBonus}%</div>
        </div>
        {/* Reserve Factor */}
        <div className="flex flex-col items-start rounded-xl bg-[#0d172b] p-4 shadow border border-blue-200/10">
          <div className="flex items-center text-blue-200 mb-1">
            <svg className="w-4 h-4 mr-1 text-purple-400" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2"/></svg>
            <span className="text-xs font-medium">Reserve Factor</span>
          </div>
          <div className="text-2xl font-bold text-white">{marketData.reserveFactor}%</div>
        </div>
      </div>

    </div>
  );
}
