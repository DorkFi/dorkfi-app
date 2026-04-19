import type { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";

/**
 * Stable key for migration-balance fetches. Parent `markets` is often a new array
 * reference on each `useOnDemandMarketData` tick (e.g. `loadingMarkets` updates) even
 * when listed rows are unchanged — depending on `markets` alone retriggers ARC200
 * `getBalance` in a tight loop.
 */
export function migrationBalanceEffectKey(
  markets: OnDemandMarketData[]
): string {
  return markets
    .filter((m) => !m.isSToken)
    .map((m) => {
      const sortKey = (m as { _sortKey?: string })._sortKey ?? "";
      return `${sortKey}:${m.asset}:${m.poolId ?? ""}:${m.configSymbol ?? ""}`;
    })
    .sort()
    .join("|");
}
