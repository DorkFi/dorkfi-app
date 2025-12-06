import React, { useState } from 'react';
import { MarketData } from './types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const InterestRateCurve = ({baseRate, slope}: { baseRate:number, slope:number }) => (
  <svg viewBox="0 0 300 80" width="100%" height="70" className="mb-2">
    <line x1="24" y1="5" x2="24" y2="70" stroke="#2c3752" strokeWidth="1.5" />
    <line x1="24" y1="70" x2="290" y2="70" stroke="#2c3752" strokeWidth="1.5" />
    <polyline fill="none" stroke="#5ef8bb" strokeWidth="2" points="24,62 157,39 290,15" />
    <text x="8" y="70" fill="#708bbd" fontSize="10">0%</text>
    <text x="6" y="62" fill="#708bbd" fontSize="10">4%</text>
    <text x="3" y="39" fill="#708bbd" fontSize="10">8%</text>
    <text x="3" y="16" fill="#708bbd" fontSize="10">16%</text>
    <text x="24" y="78" fill="#708bbd" fontSize="10">0%</text>
    <text x="72" y="78" fill="#708bbd" fontSize="10">16%</text>
    <text x="120" y="78" fill="#708bbd" fontSize="10">32%</text>
    <text x="170" y="78" fill="#708bbd" fontSize="10">56%</text>
    <text x="220" y="78" fill="#708bbd" fontSize="10">80%</text>
    <text x="275" y="78" fill="#708bbd" fontSize="10">100%</text>
  </svg>
);

export const AdvancedDetails = ({ marketData }: { marketData: MarketData }) => {
  const [expanded, setExpanded] = useState(true);
  const baseRate = 2.0;
  const slope = 13.0;
  const reserveFactor = marketData.reserveFactor;
  const supplyCap = marketData.supplyCap;
  const totalSupply = marketData.totalSupply;
  const borrowCap = marketData.borrowCap;
  const totalBorrow = marketData.totalBorrow;

  return (
    <Card className="p-0 border-0 bg-transparent shadow-none mt-5 mb-3">
      <CardHeader className="pb-4 px-4 cursor-pointer select-none flex flex-row items-center justify-between" onClick={() => setExpanded(e => !e)}>
        <CardTitle className="flex items-center gap-2 text-white text-lg font-semibold">
          <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24"><path d="M4 12h16M12 4v16" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round"/></svg>
          Advanced Details
        </CardTitle>
        <svg className={`w-6 h-6 transition-transform duration-300 text-blue-100 ml-3 ${expanded ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-6 px-4 py-0">
          <div className="p-4 bg-[#111b32] rounded mb-4">
            <div className="flex items-center mb-2 text-base text-white font-semibold"><svg className="w-5 h-5 mr-2 text-teal-400" fill="none" viewBox="0 0 24 24"><polyline points="4 14 10 10 15.5 13.5 21 8" stroke="#5ef8bb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Interest Rate Curve</div>
            <InterestRateCurve baseRate={baseRate} slope={slope} />
            <div className="text-xs text-blue-300/60 mt-1">Utilization: 0%</div>
          </div>
          <div className="p-4 bg-[#111b32] rounded mb-4">
            <div className="mb-2 font-semibold text-base text-white">Rate Parameters</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
              <div className="flex flex-col items-start">
                <span className="text-xs text-muted-foreground">Base Rate</span>
                <span className="font-semibold text-lg">2.00%</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs text-muted-foreground">Slope</span>
                <span className="font-semibold text-lg">13.00%</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs text-muted-foreground">Reserve Factor</span>
                <span className="font-semibold text-lg">{reserveFactor}%</span>
              </div>
            </div>
          </div>
          <div className="p-4 bg-[#111b32] rounded">
            <div className="mb-2 flex items-center text-base font-semibold text-white">
              <svg className="h-5 w-5 mr-2 text-green-300" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path d="M3 12v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7m-8-4v11" stroke="#33ff90" strokeWidth="2"/></svg>
              Market Caps
            </div>
            <div>
              <div className="flex items-center text-sm mb-2">
                <span className="text-blue-100/90 w-20">Supply Cap</span>
                <div className="flex-1 mx-2 h-3 rounded-lg bg-gradient-to-r from-green-300 via-green-500/70 to-white/10 relative">
                  <div className="absolute left-0 top-0 h-3 rounded-lg bg-green-400 transition-all" style={{width: `${Math.min(100, (totalSupply/supplyCap)*100)}%`}}></div>
                </div>
                <span className="font-bold text-white w-32 text-right">${totalSupply.toLocaleString()} / ${supplyCap.toLocaleString()}</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="text-blue-100/90 w-20">Borrow Cap</span>
                <div className="flex-1 mx-2 h-3 rounded-lg bg-gradient-to-r from-orange-400 via-orange-700/60 to-white/10 relative">
                  <div className="absolute left-0 top-0 h-3 rounded-lg bg-orange-400 transition-all" style={{width: `${Math.min(100, (totalBorrow/borrowCap)*100)}%`}}></div>
                </div>
                <span className="font-bold text-white w-32 text-right">${totalBorrow.toLocaleString()} / ${borrowCap.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
