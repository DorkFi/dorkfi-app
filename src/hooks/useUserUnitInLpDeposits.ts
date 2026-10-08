import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  getCuratedLiquidityPoolsForNetwork,
  pairContainsUnit,
} from "@/constants/liquidityPools";
import type { NetworkId } from "@/config";
import {
  fetchLiquidityPoolSnapshot,
  fetchNt200Arc200Balance,
} from "@/services/tinymanLiquidityService";
import { unitInLpAmount } from "@/utils/unitInLp";

export type UnitInLpDepositRow = {
  pairId: string;
  label: string;
  lpAtomic: bigint;
  unitAtomic: bigint;
  unitHuman: number;
};

/**
 * UNIT contained in Tinyman LP the user has deposited to DorkFi (nt200),
 * using live pool reserves. Wallet-held / farmed LP is not included.
 */
export function useUserUnitInLpDeposits(
  networkId: NetworkId | null | undefined,
  userAddress: string | undefined
) {
  const pairs = useMemo(() => {
    if (!networkId) return [];
    return getCuratedLiquidityPoolsForNetwork(networkId).filter(pairContainsUnit);
  }, [networkId]);

  const snapshots = useQueries({
    queries: pairs.map((pair) => ({
      queryKey: ["liquidity-pool-snapshot", pair.id, pair.networkId],
      queryFn: () => fetchLiquidityPoolSnapshot(pair),
      staleTime: 30_000,
      enabled: Boolean(networkId),
    })),
  });

  const deposits = useQueries({
    queries: pairs.map((pair) => ({
      queryKey: [
        "nt200-arc200-balance",
        pair.networkId,
        pair.lpContractId,
        userAddress,
      ],
      queryFn: () =>
        fetchNt200Arc200Balance(pair.networkId, pair.lpContractId, userAddress!),
      enabled: Boolean(userAddress) && Boolean(networkId),
      staleTime: 20_000,
    })),
  });

  const isLoading =
    Boolean(userAddress) &&
    pairs.length > 0 &&
    (snapshots.some((q) => q.isLoading) || deposits.some((q) => q.isLoading));

  const rows = useMemo(() => {
    if (!userAddress) return [];
    const out: UnitInLpDepositRow[] = [];
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const snapshot = snapshots[i]?.data;
      const lpAtomic = deposits[i]?.data ?? 0n;
      if (!snapshot || lpAtomic <= 0n) continue;
      const amount = unitInLpAmount(
        {
          pair,
          issuedLpAtomic: snapshot.totalLiquidity,
          asset1ReserveAtomic: snapshot.asset1ReserveAtomic,
          asset2ReserveAtomic: snapshot.asset2ReserveAtomic,
          asset1Decimals: snapshot.asset1.decimals,
          asset2Decimals: snapshot.asset2.decimals,
        },
        lpAtomic
      );
      if (!amount || amount.unitAtomic <= 0n) continue;
      out.push({
        pairId: pair.id,
        label: pair.label ?? pair.id,
        lpAtomic,
        unitAtomic: amount.unitAtomic,
        unitHuman: amount.unitHuman,
      });
    }
    return out;
  }, [deposits, pairs, snapshots, userAddress]);

  const unitHuman = useMemo(
    () => rows.reduce((sum, row) => sum + row.unitHuman, 0),
    [rows]
  );
  const unitAtomic = useMemo(
    () => rows.reduce((sum, row) => sum + row.unitAtomic, 0n),
    [rows]
  );

  return { rows, unitHuman, unitAtomic, isLoading };
}
