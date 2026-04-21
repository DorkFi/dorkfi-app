import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchXalgoGovernanceApr,
  xalgoAprBpsToPercentPoints,
} from "@/services/xalgoGovernanceAprService";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Governance APR for xALGO from the Folks lambda (`apr` in basis points), as percentage points
 * for {@link resolveIntrinsicSupplyApyPercent}. Inactive when `enabled` is false.
 */
export function useXalgoGovernanceLiveApyPercent(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["xalgo-governance-apr"],
    queryFn: fetchXalgoGovernanceApr,
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });

  return useMemo(
    () => xalgoAprBpsToPercentPoints(data?.apr),
    [data?.apr]
  );
}
