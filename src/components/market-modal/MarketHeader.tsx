import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MarketPoolBadge } from '@/components/markets/MarketPoolBadge';
import { formatUsdPerTokenDisplay } from '@/lib/utils';
import { MarketData } from './types';

const SPARK_W = 60;
const SPARK_H = 18;

const sparklineColorClass = (change24h: number) =>
  change24h >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

/** Renders last N points of USD price over 24h; flat line if insufficient data. */
function PriceSparkline({
  points,
  change24h,
}: {
  points: { time: number; price: number }[];
  change24h: number;
}) {
  const strokeClass = sparklineColorClass(change24h);

  if (points.length < 2) {
    return (
      <svg
        width={SPARK_W}
        height={SPARK_H}
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        fill="none"
        className={`${strokeClass} shrink-0`}
        aria-hidden
      >
        <line
          x1="0"
          y1={SPARK_H / 2}
          x2={String(SPARK_W)}
          y2={SPARK_H / 2}
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }

  const prices = points.map((p) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP;
  const pad = range < 1e-12 ? Math.max(minP * 1e-6, 1e-8) : 0;
  const lo = minP - pad;
  const hi = maxP + pad;
  const denom = hi - lo || 1;
  const padding = 2;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * SPARK_W;
    const norm = (p.price - lo) / denom;
    const y = SPARK_H - padding - norm * (SPARK_H - 2 * padding);
    return `${x},${y}`;
  });

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      fill="none"
      className={`${strokeClass} shrink-0`}
      aria-hidden
    >
      <polyline
        points={coords.join(' ')}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

export const MarketHeader = ({
  marketData,
  chainId,
  marketLabel,
}: {
  marketData: MarketData;
  chainId?: 'voi' | 'algorand';
  marketLabel?: string | null;
}) => {
  return (
    <div className="flex flex-col gap-3 min-w-0 w-full sm:flex-row sm:items-center sm:justify-between sm:gap-4 px-0 pt-0 pb-1 sm:pb-2">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative shrink-0">
          <img
            src={marketData.icon}
            alt={marketData.name}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-md bg-background p-1 border-2 border-border object-contain"
          />
          <MarketPoolBadge label={marketLabel} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground uppercase truncate max-w-full">
              {marketData.symbol}
            </span>
            {chainId && (
              <Badge variant="secondary" className="text-xs font-semibold capitalize shrink-0">
                {chainId}
              </Badge>
            )}
          </div>
          <div className="text-sm sm:text-base text-muted-foreground font-normal break-words">
            {marketData.name}
          </div>
        </div>
      </div>
      <div className="flex flex-row items-center justify-between gap-3 min-w-0 w-full sm:w-auto sm:max-w-[min(100%,11rem)] sm:flex-col sm:items-end sm:justify-center sm:gap-0.5 sm:text-right shrink-0">
        <div className="text-xl sm:text-2xl font-bold text-foreground tabular-nums break-all">
          ${formatUsdPerTokenDisplay(Number(marketData.price ?? 0))}
        </div>
        <div
          className={`text-sm font-medium flex items-center gap-1 shrink-0 tabular-nums ${
            marketData.priceChange24h >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {marketData.priceChange24h >= 0 ? '+' : ''}
          {marketData.priceChange24h?.toFixed(2)}%
          <span className="inline-block align-middle shrink-0" title="24h vs USDC (Mimir)">
            <PriceSparkline
              points={marketData.priceHistory ?? []}
              change24h={marketData.priceChange24h ?? 0}
            />
          </span>
        </div>
      </div>
    </div>
  );
};
