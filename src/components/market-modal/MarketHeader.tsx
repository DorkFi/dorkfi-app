import React from 'react';
import { MarketData } from './types';

// Placeholder for sparkline. If you want historical prices, use a chart lib or SVG.
const MiniSparkline = () => (
  <svg width="60" height="18" fill="none" viewBox="0 0 60 18">
    <polyline points="0,11 10,12 20,7 30,14 40,5 50,10 60,8" stroke="#05D484" strokeWidth="2" fill="none" />
  </svg>
);

export const MarketHeader = ({ marketData, chainId }: { marketData: MarketData; chainId?: 'voi' | 'algorand' }) => {
  return (
    <div className="flex flex-row items-center justify-between px-6 pt-6 pb-2">
      <div className="flex items-center gap-5">
        <img src={marketData.icon} alt={marketData.name} className="w-16 h-16 rounded-full shadow-lg bg-white p-2 border-2 border-blue-400" />
        <div>
          <div className="flex items-center">
            <span className="text-2xl md:text-3xl font-extrabold text-white uppercase">
              {marketData.symbol}
            </span>
            {chainId && (
              <span className="ml-2 bg-blue-900 text-blue-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                {chainId.toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-base text-blue-200/80 font-normal">
            {marketData.name}
          </div>
        </div>
      </div>
      <div className="text-right min-w-[110px] flex flex-col items-end justify-center gap-0.5">
        <div className="text-2xl font-bold text-white">
          ${marketData.price?.toFixed(2)}
        </div>
        <div className={`text-sm font-medium flex items-center gap-1 ${marketData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {marketData.priceChange24h >= 0 ? '+' : ''}{marketData.priceChange24h?.toFixed(2)}%
          <span className="inline-block align-middle"><MiniSparkline /></span>
        </div>
      </div>
    </div>
  );
};
