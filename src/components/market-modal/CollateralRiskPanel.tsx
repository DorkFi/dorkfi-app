import React from 'react';
import { MarketData } from './types';

export const CollateralRiskPanel = ({ marketData }: { marketData: MarketData }) => {
  return (
    <div className="rounded-lg border-0 p-0 mt-0 mb-0 flex flex-col gap-4 min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center gap-2 mb-0 min-w-0">
        <svg
          className="w-5 h-5 text-ocean-teal shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.29 3.86a2.37 2.37 0 0 1 3.42 0l6.09 6.37c1.17 1.23.37 3.28-1.34 3.39l-1.4.09a2 2 0 0 0-1.84 2.1l.2 2.08c.13 1.3-1.18 2.28-2.35 1.7l-1.62-.81a2.1 2.1 0 0 0-1.87 0l-1.62.81c-1.17.58-2.48-.4-2.35-1.7l.2-2.08a2 2 0 0 0-1.84-2.1l-1.4-.09c-1.71-.11-2.51-2.16-1.34-3.39l6.09-6.37Z"
          />
        </svg>
        <span className="font-semibold text-foreground text-base sm:text-lg min-w-0 break-words">
          Collateral & risk parameters
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-0 min-w-0 w-full">
        <div className="min-w-0 flex flex-col items-start rounded-xl border border-border bg-muted/30 dark:bg-muted/20 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center text-muted-foreground mb-1">
            <svg
              className="w-4 h-4 mr-1 text-blue-500 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                d="M17 16v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-medium">Max LTV</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{marketData.maxLTV}%</div>
        </div>
        <div className="min-w-0 flex flex-col items-start rounded-xl border border-border bg-muted/30 dark:bg-muted/20 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center text-muted-foreground mb-1 min-w-0">
            <svg
              className="w-4 h-4 mr-1 text-green-500 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                d="M12 2v20m10-10H2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-medium">Liquidation threshold</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
            {marketData.liquidationThreshold}%
          </div>
        </div>
        <div className="min-w-0 flex flex-col items-start rounded-xl border border-border bg-muted/30 dark:bg-muted/20 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center text-muted-foreground mb-1">
            <svg
              className="w-4 h-4 mr-1 text-amber-500 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                d="M12 5v14m-7-7h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-medium">Liquidation bonus</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
            {marketData.liquidationBonus}%
          </div>
        </div>
        <div className="min-w-0 flex flex-col items-start rounded-xl border border-border bg-muted/30 dark:bg-muted/20 p-3 sm:p-4 shadow-sm">
          <div className="flex items-center text-muted-foreground mb-1 min-w-0">
            <svg
              className="w-4 h-4 mr-1 text-purple-500 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="text-xs font-medium">Reserve factor</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
            {marketData.reserveFactor}%
          </div>
        </div>
      </div>
    </div>
  );
};
