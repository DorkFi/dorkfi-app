import type { NetworkId } from "@/config";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";
import {
  describeIndexedLendingCall,
  lendingMarketAssetLookup,
  type LendingCallKind,
} from "@/services/indexedApplTxn";

export type SavingsTxKind =
  | "deposit"
  | "withdraw"
  | "borrow"
  | "repay"
  | "activity";

export type SavingsTxRecord = {
  txId: string;
  networkId: NetworkId;
  address: string;
  poolId: string;
  assetConfigKey?: string;
  kind: SavingsTxKind;
  /** Human-readable amount, if known. */
  amount?: string;
  symbol?: string;
  timestamp: number;
  source: "local" | "chain";
};

const STORAGE_KEY = "simplfi:savings-tx-history:v1";

type StorageShape = {
  version: 1;
  records: SavingsTxRecord[];
};

function readStorage(): SavingsTxRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StorageShape;
    if (!parsed || !Array.isArray(parsed.records)) return [];
    return parsed.records;
  } catch {
    return [];
  }
}

function writeStorage(records: SavingsTxRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StorageShape = { version: 1, records: records.slice(0, 200) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function loadLocalSavingsTxHistory(filters: {
  networkId: NetworkId;
  address: string;
  poolId?: string;
}): SavingsTxRecord[] {
  const addr = filters.address.toLowerCase();
  return readStorage()
    .filter(
      (r) =>
        r.networkId === filters.networkId &&
        r.address.toLowerCase() === addr &&
        (!filters.poolId || r.poolId === filters.poolId)
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function appendLocalSavingsTx(
  record: Omit<SavingsTxRecord, "source">
): SavingsTxRecord {
  const next: SavingsTxRecord = { ...record, source: "local" };
  const all = readStorage().filter((r) => r.txId !== next.txId);
  all.unshift(next);
  writeStorage(all);
  return next;
}

function savingsKind(
  kind: LendingCallKind
): SavingsTxKind {
  if (
    kind === "deposit" ||
    kind === "withdraw" ||
    kind === "borrow" ||
    kind === "repay"
  ) {
    return kind;
  }
  return "activity";
}

/**
 * Chain history: application calls the user made against the savings pool.
 * Kind and amount come from the `lending deposit` / `lending withdraw` note.
 * A local record for the same txId still wins in {@link mergeSavingsTxHistory}.
 */
export async function fetchPoolSavingsTxns(params: {
  networkId: NetworkId;
  address: string;
  poolId: string;
  limit?: number;
}): Promise<SavingsTxRecord[]> {
  const algorandNetwork = getAlgorandNetworkFromNetworkId(params.networkId);
  if (!algorandNetwork) return [];

  const poolIdNum = Number(params.poolId);
  if (!Number.isFinite(poolIdNum) || poolIdNum <= 0) return [];

  const { indexer } = await algorandService.initializeClientsForReads(
    algorandNetwork
  );

  const response = await indexer
    .searchForTransactions()
    .address(params.address)
    .applicationID(poolIdNum)
    .txType("appl")
    .limit(params.limit ?? 25)
    .do();

  const txs = response.transactions ?? [];
  const out: SavingsTxRecord[] = [];
  const assetForMarket = lendingMarketAssetLookup(
    params.networkId,
    params.poolId
  );

  for (const raw of txs) {
    const tx = describeIndexedLendingCall(raw, assetForMarket);
    if (!tx || tx.applicationId !== poolIdNum) continue;

    out.push({
      txId: tx.txId,
      networkId: params.networkId,
      address: params.address,
      poolId: params.poolId,
      kind: savingsKind(tx.kind),
      amount: tx.amount,
      symbol: tx.symbol,
      timestamp: tx.roundTimeSec > 0 ? tx.roundTimeSec * 1000 : Date.now(),
      source: "chain",
    });
  }

  return out;
}

/** Merge local + chain, prefer local metadata for matching txIds. */
export function mergeSavingsTxHistory(
  local: SavingsTxRecord[],
  chain: SavingsTxRecord[]
): SavingsTxRecord[] {
  const byId = new Map<string, SavingsTxRecord>();
  for (const c of chain) {
    byId.set(c.txId, c);
  }
  for (const l of local) {
    byId.set(l.txId, l);
  }
  return Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
}
