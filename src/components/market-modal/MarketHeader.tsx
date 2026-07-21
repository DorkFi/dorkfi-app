import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MarketPoolBadge } from '@/components/markets/MarketPoolBadge';
import { formatUsdPerTokenDisplay } from '@/lib/utils';
import { MarketData } from './types';

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
      <div className="text-xl sm:text-2xl font-bold text-foreground tabular-nums break-all sm:text-right shrink-0">
        ${formatUsdPerTokenDisplay(Number(marketData.price ?? 0))}
      </div>
    </div>
  );
};
