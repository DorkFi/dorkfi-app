import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MarketData, UserPosition } from './types';
import { cn } from '@/lib/utils';

const periods = [
  { label: '1 Month', value: '1M', months: 1 },
  { label: '6 Months', value: '6M', months: 6 },
  { label: '1 Year', value: '1Y', months: 12 },
];

function calculateCompoundedEarnings(
  amount: number,
  apy: number,
  months: number,
) {
  const n = 12;
  const t = months / 12;
  const r = apy / 100;
  if (amount === 0 || apy === 0) return 0;
  return amount * (Math.pow(1 + r / n, n * t) - 1);
}

export const EarningsCalculator = ({
  userPosition: _userPosition,
  marketData,
}: {
  userPosition?: UserPosition;
  marketData: MarketData;
}) => {
  void _userPosition;
  const [amount, setAmount] = useState(1000);
  const min = 100;
  const max = 100000;
  const [selectedPeriod, setSelectedPeriod] = useState(periods[2]);

  const supplyAPY = marketData.supplyAPY ?? 0;
  const borrowAPY = marketData.borrowAPY ?? 0;
  const supplyEarned = calculateCompoundedEarnings(amount, supplyAPY, selectedPeriod.months);
  const borrowCost = calculateCompoundedEarnings(amount, borrowAPY, selectedPeriod.months);

  return (
    <div className="p-0 rounded-lg border-0 mt-0 mb-0 min-w-0 w-full">
      <div className="font-semibold text-foreground flex items-center gap-2 mb-2 text-lg">
        <svg
          className="w-5 h-5 text-ocean-teal shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            d="M8 12h8m-8 4h5m-2.5-12a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Z"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Earnings calculator
      </div>
      <div className="mb-2 mt-3 flex flex-row items-center justify-between text-sm font-medium text-muted-foreground">
        <span>Amount</span>
        <span className="text-foreground text-base font-semibold">
          ${amount.toLocaleString()}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={amount}
        step={100}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="w-full mb-1 accent-ocean-teal"
      />
      <div className="flex justify-between text-xs text-muted-foreground mb-3">
        <span>${min.toLocaleString()}</span>
        <span>${max.toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3 mt-1 min-w-0 w-full">
        {periods.map((p) => (
          <Button
            key={p.value}
            type="button"
            variant={selectedPeriod.value === p.value ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'min-w-0 w-full px-1 sm:px-3 text-[11px] sm:text-sm',
              selectedPeriod.value === p.value &&
                'bg-ocean-teal hover:bg-ocean-teal/90 text-white border-ocean-teal'
            )}
            onClick={() => setSelectedPeriod(p)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full min-w-0 mt-1">
        <div className="min-w-0 w-full rounded-xl border border-green-600/30 bg-green-500/5 dark:bg-green-950/30 p-3 sm:p-4 shadow-sm text-left">
          <div className="flex items-center mb-0.5">
            <svg
              className="h-4 w-4 mr-1 text-green-600 dark:text-green-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-semibold text-green-700 dark:text-green-400 text-sm">
              If supplying
            </span>
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-green-600 dark:text-green-400 break-all">
            +${supplyEarned.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            at {supplyAPY.toFixed(2)}% APY
          </div>
        </div>
        <div className="min-w-0 w-full rounded-xl border border-orange-600/30 bg-orange-500/5 dark:bg-orange-950/30 p-3 sm:p-4 shadow-sm text-left">
          <div className="flex items-center mb-0.5">
            <svg
              className="h-4 w-4 mr-1 text-orange-600 dark:text-orange-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a5 5 0 00-10 0v2a5 5 0 00-2 4v5a5 5 0 005 5h2a5 5 0 005-5v-5a5 5 0 00-2-4z"
              />
            </svg>
            <span className="font-semibold text-orange-700 dark:text-orange-400 text-sm">
              If borrowing
            </span>
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-orange-600 dark:text-orange-400 break-all">
            -${borrowCost.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            at {borrowAPY.toFixed(2)}% APY
          </div>
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-muted-foreground">
        Calculations assume compounding interest. Actual results may vary.
      </div>
    </div>
  );
};
