import React, { useState } from 'react';
import { MarketData, UserPosition } from './types';

export const HealthFactorSimulator = ({ userPosition, marketData }: {
  userPosition?: UserPosition;
  marketData: MarketData;
}) => {
  const [borrowDelta, setBorrowDelta] = useState(0);

  if (!userPosition) return null;

  // Simulate new health factor: this is a placeholder calc.
  const simulatedHealthFactor = Math.max(
    0,
    userPosition.healthFactor - borrowDelta * 0.01
  );

  const risk = simulatedHealthFactor >= 2
    ? { text: 'Low Risk', color: 'text-green-400' }
    : simulatedHealthFactor >= 1.1
      ? { text: 'Warning', color: 'text-yellow-400' }
      : { text: 'Danger', color: 'text-red-400' };

  return (
    <div className="bg-[#131d35] p-4 rounded-2xl shadow border border-white/5 mb-2 mt-4">
      <div className="font-semibold text-blue-200 flex items-center mb-3">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.418 0-8-2.239-8-5v-5c0-2.761 3.582-5 8-5s8 2.239 8 5v5m-4 2.5l2 2m0 0l2-2m-2 2V15" /></svg>
        Health Factor Simulator
      </div>
      <div className="flex flex-row gap-4">
        <div className="flex-1 flex flex-col items-center bg-gradient-to-br from-green-900/40 to-blue-800/10 rounded-xl p-4 mr-2">
          <span className="text-xs text-blue-100/70 mb-2">Current HF</span>
          <span className="text-2xl font-bold text-green-300">{userPosition.healthFactor.toFixed(2)}</span>
        </div>
        <div className="flex-1 flex flex-col items-center bg-gradient-to-br from-blue-900/40 to-blue-800/10 rounded-xl p-4 ml-2">
          <span className="text-xs text-blue-100/70 mb-2">Simulated HF</span>
          <span className={`text-2xl font-bold ${risk.color}`}>{simulatedHealthFactor.toFixed(2)}</span>
          <span className={`text-xs ${risk.color}`}>{risk.text}</span>
        </div>
      </div>
      <div className="mt-3">
        <div className="font-medium text-blue-100/70 text-xs mb-1">Borrow Amount</div>
        <input
          type="range"
          min={0}
          max={userPosition.borrowable}
          value={borrowDelta}
          onChange={e => setBorrowDelta(Number(e.target.value))}
          className="w-full mt-1 accent-yellow-400"
        />
        <div className="flex justify-between text-xs text-blue-200/80 mt-1">
          <span>${borrowDelta}</span>
          <span>Max: ${userPosition.borrowable}</span>
        </div>
      </div>
    </div>
  );
};

