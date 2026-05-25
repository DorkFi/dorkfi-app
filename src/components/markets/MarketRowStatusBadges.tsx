import { Sparkles, Gift, Ban } from "lucide-react";
import type { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import { isAtBorrowCap, isAtDepositCap } from "@/constants/lendingCaps";
import { cn } from "@/lib/utils";

interface MarketRowStatusBadgesProps {
  market: OnDemandMarketData;
  className?: string;
}

const statusBadgeBase =
  "inline-flex max-w-full flex-row flex-nowrap items-center justify-center gap-1 shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none sm:px-2 sm:text-[11px]";

function CapBadge({
  label,
  shortLabel,
  title,
}: {
  label: string;
  shortLabel: string;
  title: string;
}) {
  return (
    <span
      className={cn(
        statusBadgeBase,
        "border-border/80 bg-muted/30 text-muted-foreground"
      )}
      title={title}
      aria-label={title}
    >
      <Ban className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden />
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

/**
 * Compact row badges: new listing, rewards, supply/borrow cap.
 */
export function MarketRowStatusBadges({
  market,
  className,
}: MarketRowStatusBadgesProps) {
  const atSupplyCap = isAtDepositCap(
    market.totalSupply,
    market.supplyCap
  );
  const atBorrowCap = isAtBorrowCap(market.totalBorrow, market.borrowCap);

  const showNew = market.isNew;
  const showRewards = market.hasRewards;

  if (!showNew && !showRewards && !atSupplyCap && !(atBorrowCap && !market.isSToken)) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex w-max max-w-full flex-wrap items-center justify-center gap-1",
        className
      )}
    >
      {showNew && (
        <span
          className={cn(
            statusBadgeBase,
            "border-ocean-teal/25 bg-ocean-teal/15 text-ocean-teal"
          )}
        >
          <Sparkles className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden />
          New
        </span>
      )}
      {showRewards && (
        <span
          className={cn(
            statusBadgeBase,
            "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300"
          )}
        >
          <Gift className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden />
          Rewards
        </span>
      )}
      {atSupplyCap && (
        <CapBadge
          label="Supply cap"
          shortLabel="S. cap"
          title="Supply cap nearly full"
        />
      )}
      {atBorrowCap && !market.isSToken && (
        <CapBadge
          label="Borrow cap"
          shortLabel="B. cap"
          title="Borrow cap nearly full"
        />
      )}
    </div>
  );
}

export default MarketRowStatusBadges;
