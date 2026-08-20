import { useCallback, useEffect, useMemo, useState } from "react";
import type { NetworkId } from "@/config";
import {
  appendLocalBorrowTx,
  fetchPoolBorrowTxns,
  loadLocalBorrowTxHistory,
  mergeBorrowTxHistory,
  type BorrowTxKind,
  type BorrowTxRecord,
} from "@/services/borrowTransactionHistory";

export type RecordBorrowTxInput = {
  txId: string;
  kind: Exclude<BorrowTxKind, "activity">;
  amount: string;
  symbol: string;
  poolId: string;
  assetConfigKey?: string;
};

/**
 * Borrow/repay history: local records + optional indexer rows.
 * Uses useEffect (not useQuery) for simpler refresh / HMR behavior.
 *
 * When `allPools` is true, loads local history for the address and, if
 * `poolIds` are provided, merges chain indexer rows for each pool.
 */
export function useBorrowTransactionHistory(params: {
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
  const canQuery = Boolean(enabled && address && (allPools || poolId));

  const [items, setItems] = useState<BorrowTxRecord[]>([]);
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
      const local = loadLocalBorrowTxHistory({
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
              return await fetchPoolBorrowTxns({
                networkId,
                address,
                poolId: id,
                limit: 25,
              });
            } catch {
              return [] as BorrowTxRecord[];
            }
          })
        );
        setItems(mergeBorrowTxHistory(local, chainLists.flat()));
        return;
      }
      if (!poolId) return;
      let chain: BorrowTxRecord[] = [];
      try {
        chain = await fetchPoolBorrowTxns({
          networkId,
          address,
          poolId,
          limit: 25,
        });
      } catch {
        // Indexer optional.
      }
      setItems(mergeBorrowTxHistory(local, chain));
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

  const recordTx = useCallback(
    (input: RecordBorrowTxInput) => {
      if (!address) return;
      appendLocalBorrowTx({
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
      recordTx,
      refresh: reload,
    }),
    [items, isLoading, recordTx, reload]
  );
}
