import React, { useState } from 'react';
import { MarketData, UserPosition } from './types';

const periods = [
  { label: '1 Month', value: '1M', months: 1 },
  { label: '6 Months', value: '6M', months: 6 },
  { label: '1 Year', value: '1Y', months: 12 },
];

// Compounding formula: principal * ((1 + apy/n)^(n*t) - 1)
function calculateCompoundedEarnings(
  amount: number,
  apy: number, // as percent
  months: number,
) {
  const n = 12; // compounding monthly
  const t = months / 12;
  const r = apy / 100;
  // Avoid error for zero
  if (amount === 0 || apy === 0) return 0;
  return amount * (Math.pow(1 + r / n, n * t) - 1);
}

export const EarningsCalculator = ({ userPosition, marketData }: {
  userPosition?: UserPosition;
  marketData: MarketData;
}) => {
  // Simulate amount, default $1000, min $100, max $100,000
  const [amount, setAmount] = useState(1000);
  const min = 100;
  const max = 100000;
  const [selectedPeriod, setSelectedPeriod] = useState(periods[2]);

  const supplyAPY = marketData.supplyAPY ?? 0;
  const borrowAPY = marketData.borrowAPY ?? 0;
  const supplyEarned = calculateCompoundedEarnings(amount, supplyAPY, selectedPeriod.months);
  const borrowCost = calculateCompoundedEarnings(amount, borrowAPY, selectedPeriod.months);

  return (
    <div className="bg-[#0f192e] p-6 rounded-2xl border border-blue-100/5 mt-4 mb-4 shadow-md min-w-[340px]">
      <div className="font-semibold text-white flex items-center mb-2 text-lg">
        <svg className="w-5 h-5 mr-2 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><path d="M8 12h8m-8 4h5m-2.5-12a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Earnings Calculator
      </div>
      <div className="mb-2 mt-3 flex flex-row items-center justify-between text-sm font-medium text-blue-100/80">
        <span>Amount</span>
        <span className="text-white text-base font-semibold">${amount.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={amount}
        step={100}
        onChange={e => setAmount(Number(e.target.value))}
        className="w-full mb-1 accent-cyan-400"
      />
      <div className="flex justify-between text-xs text-blue-300/60 mb-3">
        <span>${min.toLocaleString()}</span>
        <span>${max.toLocaleString()}</span>
      </div>
      <div className="flex flex-row gap-2 mb-3 mt-1">
        {periods.map((p) => (
          <button
            key={p.value}
            className={`flex-1 py-1.5 rounded-lg font-bold text-sm transition-colors border-2 ${selectedPeriod.value === p.value ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-blue-900 border-cyan-400' : 'bg-[#12203a] text-blue-200 border-transparent hover:bg-blue-900/40'}`}
            onClick={() => setSelectedPeriod(p)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-row gap-3 w-full mt-1">
        <div className="flex-1 rounded-xl border border-green-700/40 bg-gradient-to-bl from-green-950/50 to-[#14302e]/90 p-4 shadow text-left">
          <div className="flex items-center mb-0.5">
            <svg className="h-4 w-4 mr-1 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
            <span className="font-semibold text-green-300 text-sm">If Supplying</span>
          </div>
          <div className="mt-1 text-2xl font-extrabold text-green-400">+${supplyEarned.toFixed(2)}</div>
          <div className="text-xs text-green-200/80 mt-0.5">at {supplyAPY.toFixed(2)}% APY</div>
        </div>
        <div className="flex-1 rounded-xl border border-orange-700/30 bg-gradient-to-bl from-orange-950/40 to-[#33241a]/80 p-4 shadow text-left">
          <div className="flex items-center mb-0.5">
            <svg className="h-4 w-4 mr-1 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a5 5 0 00-10 0v2a5 5 0 00-2 4v5a5 5 0 005 5h2a5 5 0 005-5v-5a5 5 0 00-2-4z"/></svg>
            <span className="font-semibold text-orange-300 text-sm">If Borrowing</span>
          </div>
          <div className="mt-1 text-2xl font-extrabold text-orange-400">-${borrowCost.toFixed(2)}</div>
          <div className="text-xs text-orange-200/80 mt-0.5">at {borrowAPY.toFixed(2)}% APY</div>
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-blue-200/70">
        Calculations assume compounding interest. Actual results may vary.
      </div>
    </div>
  );
};
