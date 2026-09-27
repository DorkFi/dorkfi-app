import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  getNetworkConfig,
  getRewardsProgramPublicBaseUrl,
  getTokenConfig,
  type NetworkId,
} from "@/config";
import { fetchRewardAprStats } from "@/services/rewardAprStatsService";
import { effectiveHasRewards } from "@/constants/algorandAMarketRewards";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fetches and caches `targetAprAdjustedToSupplyPercent` per rewards deployment origin
 * (24h). React Query dedupes with Markets table when the same origins are used.
 */
export function useRewardsAprBonusMap(networkIds: NetworkId[]) {
  const baseUrls = useMemo(() => {
    const set = new Set<string>();
    for (const nid of networkIds) {
      try {
        const cfg = getNetworkConfig(nid);
        for (const [, tc] of Object.entries(cfg.tokens)) {
          const rows = Array.isArray(tc) ? tc : [tc];
          for (const row of rows) {
            if (!row.hasRewards || row.poolId == null || row.contractId == null) {
              continue;
            }
            const u = getRewardsProgramPublicBaseUrl(
              nid,
              row.poolId,
              row.contractId,
              row
            );
            if (u) set.add(u);
          }
        }
      } catch {
        // network missing from config
      }
    }
    return [...set];
  }, [networkIds]);

  const queries = useQueries({
    queries: baseUrls.map((baseUrl) => ({
      queryKey: ["reward-apr-stats", baseUrl] as const,
      queryFn: () => fetchRewardAprStats(baseUrl),
      enabled: baseUrl.length > 0,
      staleTime: DAY_MS,
      gcTime: DAY_MS,
    })),
  });

  return useMemo(() => {
    const out: Record<string, number> = {};
    baseUrls.forEach((url, i) => {
      const v = queries[i]?.data?.targetAprAdjustedToSupplyPercent;
      if (typeof v === "number" && Number.isFinite(v)) {
        out[url] = v;
      }
    });
    return out;
  }, [baseUrls, queries]);
}

/** Optional market totals for Algorand A excess gate (supply − borrow). */
export type RewardsBonusMarketTotals = {
  totalSupply?: number;
  totalBorrow?: number;
};

/** Map `fetchAllMarkets` / Portfolio row fields to bonus-APR excess totals. */
export function rewardsBonusTotalsFromMarketRow(
  market:
    | {
        totalDeposits?: string | number | null;
        totalBorrows?: string | number | null;
      }
    | null
    | undefined
): RewardsBonusMarketTotals {
  return {
    totalSupply: Number(market?.totalDeposits ?? 0) || 0,
    totalBorrow: Number(market?.totalBorrows ?? 0) || 0,
  };
}

/** Bonus supply APR (% points) for a token row when `hasRewards` + registry resolve. */
export function getRewardsBonusSupplyAprPercent(
  networkId: NetworkId | string | undefined,
  asset: string,
  poolId: string | undefined,
  rewardsAprByBaseUrl: Record<string, number>,
  marketTotals?: RewardsBonusMarketTotals
): number {
  if (!networkId || !poolId) return 0;
  const nid = networkId as NetworkId;
  const raw = getTokenConfig(nid, asset);
  const config = Array.isArray(raw)
    ? raw.find((c) => String(c.poolId) === String(poolId)) ?? raw[0]
    : raw;
  if (
    !effectiveHasRewards({
      hasRewards: config?.hasRewards === true,
      networkId: nid,
      poolId,
      totalSupply: marketTotals?.totalSupply,
      totalBorrow: marketTotals?.totalBorrow,
    }) ||
    config?.contractId == null
  ) {
    return 0;
  }
  const origin = getRewardsProgramPublicBaseUrl(
    nid,
    poolId,
    config.contractId,
    config
  );
  if (!origin) return 0;
  const v = rewardsAprByBaseUrl[origin];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
