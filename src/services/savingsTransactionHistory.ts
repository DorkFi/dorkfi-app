import type { NetworkId } from "@/config";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import algorandService from "@/services/algorandService";

export type SavingsTxKind = "deposit" | "withdraw" | "activity";

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

/**
 * Best-effort chain history: application calls the user made against the savings pool.
 * Amounts/kind are incomplete on-chain without ABI decoding, so records are "activity"
 * unless we already saved richer local metadata for the same txId.
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

  const txs = (response as { transactions?: unknown[] }).transactions ?? [];
  const out: SavingsTxRecord[] = [];

  for (const raw of txs) {
    const tx = raw as {
      id?: string;
      "tx-type"?: string;
      "round-time"?: number;
      "confirmed-round"?: number;
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
      typeof tsSec === "number" && tsSec > 0
        ? tsSec * 1000
        : Date.now();

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
