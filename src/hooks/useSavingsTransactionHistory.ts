import { useCallback, useEffect, useMemo, useState } from "react";
import type { NetworkId } from "@/config";
import { ACCOUNT_ACTIVITY_EVENT } from "@/lib/easyStart/accountActivity";
import {
  appendLocalSavingsTx,
  fetchPoolSavingsTxns,
  loadLocalSavingsTxHistory,
  mergeSavingsTxHistory,
  type SavingsTxKind,
  type SavingsTxRecord,
} from "@/services/savingsTransactionHistory";

export type RecordSavingsTxInput = {
  txId: string;
  kind: Exclude<SavingsTxKind, "activity">;
  amount: string;
  symbol: string;
  poolId: string;
  assetConfigKey?: string;
};

/**
 * Savings deposit/withdraw history: local records + optional indexer rows.
 * Uses useEffect (not useQuery) for simpler refresh / HMR behavior.
 *
 * When `allPools` is true, loads local history for the address and, if
 * `poolIds` are provided, merges chain indexer rows for each pool.
 */
export function useSavingsTransactionHistory(params: {
  networkId: NetworkId;
  address?: string | null;
  poolId?: string | null;
  /** Load history across all pools (portfolio). */
  allPools?: boolean;
  /** Pool ids to fetch from the indexer when `allPools` is true. */
  poolIds?: readonly string[];
  enabled?: boolean;
}) {
  const {
    networkId,
    address,
    poolId,
    allPools = false,
    poolIds,
    enabled = true,
  } = params;
  const poolIdsKey = (poolIds ?? [])
    .filter(Boolean)
    .slice()
    .sort()
    .join(",");
  const canQuery = Boolean(
    enabled && address && (allPools || poolId)
  );

  const [items, setItems] = useState<SavingsTxRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!address) {
      setItems([]);
      return;
    }
    if (!allPools && !poolId) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const local = loadLocalSavingsTxHistory({
        networkId,
        address,
        poolId: allPools ? undefined : poolId ?? undefined,
      });
      // Local first for snappy paint.
      setItems(local);
      if (allPools) {
        const ids = poolIdsKey ? poolIdsKey.split(",") : [];
        if (ids.length === 0) return;
        const chainLists = await Promise.all(
          ids.map(async (id) => {
            try {
              return await fetchPoolSavingsTxns({
                networkId,
                address,
                poolId: id,
                limit: 25,
              });
            } catch {
              return [] as SavingsTxRecord[];
            }
          })
        );
        setItems(mergeSavingsTxHistory(local, chainLists.flat()));
        return;
      }
      if (!poolId) return;
      let chain: SavingsTxRecord[] = [];
      try {
        chain = await fetchPoolSavingsTxns({
          networkId,
          address,
          poolId,
          limit: 25,
        });
      } catch {
        // Indexer optional.
      }
      setItems(mergeSavingsTxHistory(local, chain));
    } finally {
      setIsLoading(false);
    }
  }, [address, networkId, poolId, allPools, poolIdsKey]);

  useEffect(() => {
    if (!canQuery) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    void reload();
  }, [canQuery, reload]);

  useEffect(() => {
    if (!canQuery || typeof window === "undefined") return;
    const onActivity = () => {
      void reload();
    };
    window.addEventListener(ACCOUNT_ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(ACCOUNT_ACTIVITY_EVENT, onActivity);
  }, [canQuery, reload]);

  const recordTx = useCallback(
    (input: RecordSavingsTxInput) => {
      if (!address) return;
      appendLocalSavingsTx({
        txId: input.txId,
        networkId,
        address,
        poolId: input.poolId,
        assetConfigKey: input.assetConfigKey,
        kind: input.kind,
        amount: input.amount,
        symbol: input.symbol,
        timestamp: Date.now(),
      });
      void reload();
    },
    [address, networkId, reload]
  );

  return useMemo(
    () => ({
      items,
      isLoading,
      isError: false,
      error: null,
      recordTx,
      refresh: reload,
    }),
    [items, isLoading, recordTx, reload]
  );
}
