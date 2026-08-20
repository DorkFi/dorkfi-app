import type { NetworkId } from "@/config";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";

export type BorrowTxKind = "borrow" | "repay" | "supply" | "activity";

export type BorrowTxRecord = {
  txId: string;
  networkId: NetworkId;
  address: string;
  poolId: string;
  assetConfigKey?: string;
  kind: BorrowTxKind;
  amount?: string;
  symbol?: string;
  timestamp: number;
  source: "local" | "chain";
};

const STORAGE_KEY = "simplfi:borrow-tx-history:v1";

type StorageShape = {
  version: 1;
  records: BorrowTxRecord[];
};

function readStorage(): BorrowTxRecord[] {
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

function writeStorage(records: BorrowTxRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StorageShape = { version: 1, records: records.slice(0, 200) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function loadLocalBorrowTxHistory(filters: {
  networkId: NetworkId;
  address: string;
  poolId?: string;
}): BorrowTxRecord[] {
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

export function appendLocalBorrowTx(
  record: Omit<BorrowTxRecord, "source">
): BorrowTxRecord {
  const next: BorrowTxRecord = { ...record, source: "local" };
  const all = readStorage().filter((r) => r.txId !== next.txId);
  all.unshift(next);
  writeStorage(all);
  return next;
}

/**
 * Best-effort chain history: application calls the user made against the lending pool.
 * Kind/amount are incomplete without ABI decoding, so chain rows are "activity"
 * unless local metadata already exists for the same txId.
 */
export async function fetchPoolBorrowTxns(params: {
  networkId: NetworkId;
  address: string;
  poolId: string;
  limit?: number;
}): Promise<BorrowTxRecord[]> {
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

  const txs = (response as { transactions?: unknown[] }).transactions ?? [];
  const out: BorrowTxRecord[] = [];

  for (const raw of txs) {
    const tx = raw as {
      id?: string;
      "round-time"?: number;
      sender?: string;
      "application-transaction"?: {
        "application-id"?: number | bigint;
      };
    };
    const txId = tx.id;
    if (!txId) continue;

    const appId = Number(
      tx["application-transaction"]?.["application-id"] ?? 0
    );
    if (appId !== poolIdNum) continue;

    const tsSec = tx["round-time"];
    const timestamp =
      typeof tsSec === "number" && tsSec > 0 ? tsSec * 1000 : Date.now();

    out.push({
      txId,
      networkId: params.networkId,
      address: params.address,
      poolId: params.poolId,
      kind: "activity",
      timestamp,
      source: "chain",
    });
  }

  return out;
}

export function mergeBorrowTxHistory(
  local: BorrowTxRecord[],
  chain: BorrowTxRecord[]
): BorrowTxRecord[] {
  const byId = new Map<string, BorrowTxRecord>();
  for (const c of chain) {
    byId.set(c.txId, c);
  }
  for (const l of local) {
    byId.set(l.txId, l);
  }
  return Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp);
}
