import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchTinymanLiquidStakingStatistics,
  tinymanRateFractionToPercentPoints,
} from "@/services/tinymanLiquidStakingService";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Live liquid-staking APR from Tinyman (`liquid_staking_annual_percentage_rate`), as percentage
 * points — pass as `live.tinymanLiquidStakingPercent` to {@link resolveIntrinsicSupplyApyPercent}.
 * Inactive when `enabled` is false.
 * Cached 24h (stale + gc) so the analytics endpoint is not hit more than once per day per client.
 */
export function useTinymanLiquidStakingLiveApyPercent(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["tinyman-liquid-staking-statistics"],
    queryFn: fetchTinymanLiquidStakingStatistics,
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });

  return useMemo(
    () =>
      tinymanRateFractionToPercentPoints(
        data?.liquid_staking_annual_percentage_rate
      ),
    [data?.liquid_staking_annual_percentage_rate]
  );
}
