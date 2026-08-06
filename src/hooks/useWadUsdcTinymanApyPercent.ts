import { useQuery } from "@tanstack/react-query";
import type { NetworkId } from "@/config";
import { getLiquidityPoolDisplayApyPercent } from "@/hooks/useLiquidityPoolData";
import { getWadUsdcLiquidityPair } from "@/services/leveragedWadLpService";
import { fetchLiquidityPoolSnapshot } from "@/services/tinymanLiquidityService";

/**
 * Live Tinyman WAD/USDC pool APY (swap fees + farm programs) as percentage points.
 * Shares the `liquidity-pool-snapshot` query key with Liquidity pages.
 */
export function useWadUsdcTinymanApyPercent(
  networkId: NetworkId,
  enabled = true
): { apyPercent: number | null; isLoading: boolean } {
  const pair = getWadUsdcLiquidityPair(networkId);
  const active = Boolean(enabled && pair);

  const query = useQuery({
    queryKey: ["liquidity-pool-snapshot", pair?.id, pair?.networkId],
    queryFn: () => fetchLiquidityPoolSnapshot(pair!),
    enabled: active,
    staleTime: 30_000,
  });

  return {
    apyPercent: active
      ? getLiquidityPoolDisplayApyPercent(query.data?.apr)
      : null,
    isLoading: active && query.isLoading,
  };
}
