import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  getNetworkConfig,
  getRewardsProgramPublicBaseUrl,
  getTokenConfig,
  type NetworkId,
} from "@/config";
import { fetchRewardAprStats } from "@/services/rewardAprStatsService";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fetches and caches `targetAprAdjustedToSupplyPercent` per rewards deployment origin (24h).
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

/** Bonus supply APR (% points) for a token row when `hasRewards` + registry resolve. */
export function getRewardsBonusSupplyAprPercent(
  networkId: NetworkId | string | undefined,
  asset: string,
  poolId: string | undefined,
  rewardsAprByBaseUrl: Record<string, number>
): number {
  if (!networkId || !poolId) return 0;
  const nid = networkId as NetworkId;
  const raw = getTokenConfig(nid, asset);
  const config = Array.isArray(raw)
    ? raw.find((c) => String(c.poolId) === String(poolId)) ?? raw[0]
    : raw;
  if (!config?.hasRewards || config.contractId == null) return 0;
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
