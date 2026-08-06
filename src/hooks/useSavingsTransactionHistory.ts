import { useCallback, useEffect, useMemo, useState } from "react";
import type { NetworkId } from "@/config";
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
 * When `poolId` is omitted/null, loads all local history for the address
 * (used for portfolio chart). Chain indexer fetch still requires a pool id.
 */
export function useSavingsTransactionHistory(params: {
  networkId: NetworkId;
  address?: string | null;
  poolId?: string | null;
  /** Load local history across all pools (portfolio). Implies no chain fetch. */
  allPools?: boolean;
  enabled?: boolean;
}) {
  const {
    networkId,
    address,
    poolId,
    allPools = false,
    enabled = true,
  } = params;
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
      if (allPools || !poolId) {
        return;
      }
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
  }, [address, networkId, poolId, allPools]);

  useEffect(() => {
    if (!canQuery) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    void reload();
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
