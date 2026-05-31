import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { LiquidityPoolPairConfig } from "@/constants/liquidityPools";
import {
  fetchLiquidityPoolSnapshot,
  fetchLiquidityPoolUserPosition,
  fetchAlgorandAssetBalance,
  fetchNt200Arc200Balance,
  type LiquidityPoolApr,
} from "@/services/tinymanLiquidityService";

export function getLiquidityPoolDisplayAprPercent(
  apr: LiquidityPoolApr | null | undefined
): number | null {
  if (!apr) return null;
  return apr.totalAprPercent ?? apr.feeAprPercent ?? null;
}

export function useLiquidityPoolsOrderedByApr(
  pairs: LiquidityPoolPairConfig[]
) {
  const snapshots = useQueries({
    queries: pairs.map((pair) => ({
      queryKey: ["liquidity-pool-snapshot", pair.id, pair.networkId],
      queryFn: () => fetchLiquidityPoolSnapshot(pair),
      staleTime: 30_000,
    })),
  });

  return useMemo(() => {
    return pairs
      .map((pair, index) => ({
        pair,
        apr: getLiquidityPoolDisplayAprPercent(snapshots[index]?.data?.apr),
      }))
      .sort((a, b) => {
        if (a.apr == null && b.apr == null) return 0;
        if (a.apr == null) return 1;
        if (b.apr == null) return -1;
        return b.apr - a.apr;
      })
      .map(({ pair }) => pair);
  }, [pairs, snapshots]);
}

export function useLiquidityPoolSnapshot(pair: LiquidityPoolPairConfig) {
  return useQuery({
    queryKey: ["liquidity-pool-snapshot", pair.id, pair.networkId],
    queryFn: () => fetchLiquidityPoolSnapshot(pair),
    staleTime: 30_000,
  });
}

export function useLiquidityPoolPosition(
  pair: LiquidityPoolPairConfig,
  userAddress: string | undefined
) {
  return useQuery({
    queryKey: ["liquidity-pool-position", pair.id, userAddress],
    queryFn: () => fetchLiquidityPoolUserPosition(pair, userAddress!),
    enabled: Boolean(userAddress),
    staleTime: 20_000,
  });
}

export function useAlgorandAssetBalance(
  networkId: LiquidityPoolPairConfig["networkId"],
  userAddress: string | undefined,
  assetId: number,
  enabled = true
) {
  return useQuery({
    queryKey: ["algorand-asset-balance", networkId, userAddress, assetId],
    queryFn: () => fetchAlgorandAssetBalance(networkId, userAddress!, assetId),
    enabled: Boolean(userAddress) && enabled,
    staleTime: 20_000,
  });
}

export function useNt200Arc200Balance(
  networkId: LiquidityPoolPairConfig["networkId"],
  contractId: number,
  userAddress: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ["nt200-arc200-balance", networkId, contractId, userAddress],
    queryFn: () => fetchNt200Arc200Balance(networkId, contractId, userAddress!),
    enabled: Boolean(userAddress) && enabled,
    staleTime: 20_000,
  });
}

export function useInvalidateLiquidityPools(pairs: LiquidityPoolPairConfig[]) {
  const queryClient = useQueryClient();
  return () => {
    pairs.forEach((pair) => {
      void queryClient.invalidateQueries({
        queryKey: ["liquidity-pool-snapshot", pair.id, pair.networkId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["liquidity-pool-position", pair.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["algorand-asset-balance", pair.networkId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["nt200-arc200-balance", pair.networkId, pair.lpContractId],
      });
    });
  };
}
