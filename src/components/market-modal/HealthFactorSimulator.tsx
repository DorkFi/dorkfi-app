import React, { useState } from 'react';
import { MarketData, UserPosition } from './types';

export const HealthFactorSimulator = ({
  userPosition,
  marketData: _marketData,
}: {
  userPosition?: UserPosition;
  marketData: MarketData;
}) => {
  const [borrowDelta, setBorrowDelta] = useState(0);
  void _marketData;

  if (!userPosition) return null;

  const simulatedHealthFactor = Math.max(
    0,
    userPosition.healthFactor - borrowDelta * 0.01
  );

  const risk =
    simulatedHealthFactor >= 2
      ? { text: 'Low risk', color: 'text-green-600 dark:text-green-400' }
      : simulatedHealthFactor >= 1.1
        ? { text: 'Warning', color: 'text-amber-600 dark:text-amber-400' }
        : { text: 'Danger', color: 'text-red-600 dark:text-red-400' };

  return (
    <div className="p-0 rounded-lg border-0 mb-0 mt-0 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="font-semibold text-foreground flex items-center gap-2 mb-3">
        <svg
          className="w-5 h-5 text-ocean-teal shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.418 0-8-2.239-8-5v-5c0-2.761 3.582-5 8-5s8 2.239 8 5v5m-4 2.5l2 2m0 0l2-2m-2 2V15"
          />
        </svg>
        Health factor simulator
      </div>
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 sm:gap-4 min-w-0 w-full">
        <div className="min-w-0 flex flex-col items-center rounded-xl border border-border bg-muted/30 dark:bg-muted/20 p-3 sm:p-4">
          <span className="text-xs text-muted-foreground mb-2">Current HF</span>
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">
            {userPosition.healthFactor.toFixed(2)}
          </span>
        </div>
        <div className="flex-1 min-w-[140px] flex flex-col items-center rounded-xl border border-border bg-muted/30 dark:bg-muted/20 p-4">
          <span className="text-xs text-muted-foreground mb-2">Simulated HF</span>
          <span className={`text-2xl font-bold ${risk.color}`}>
            {simulatedHealthFactor.toFixed(2)}
          </span>
          <span className={`text-xs ${risk.color}`}>{risk.text}</span>
        </div>
      </div>
      <div className="mt-3">
        <div className="font-medium text-muted-foreground text-xs mb-1">Borrow amount</div>
        <input
          type="range"
          min={0}
          max={userPosition.borrowable}
          value={borrowDelta}
          onChange={(e) => setBorrowDelta(Number(e.target.value))}
          className="w-full mt-1 accent-ocean-teal"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>${borrowDelta}</span>
          <span>Max: ${userPosition.borrowable}</span>
        </div>
      </div>
    </div>
  );
};
