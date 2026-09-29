import algosdk from "algosdk";
import { getAllTokens, type NetworkId } from "@/config";

/**
 * algosdk 3 decodes indexer search hits into camelCase models.
 * Older call sites read the raw JSON names and dropped every row.
 */
export type IndexedApplTxn = {
  txId: string;
  applicationId: number;
  /** Block time in seconds. 0 when the indexer omitted it. */
  roundTimeSec: number;
};

export type LendingCallKind =
  | "deposit"
  | "withdraw"
  | "borrow"
  | "repay"
  | "activity";

export type DescribedLendingCall = IndexedApplTxn & {
  kind: LendingCallKind;
  /**
   * Human amount. Deposit and withdraw notes already include one.
   * Borrow and repay notes do not, so those use the call's uint256.
   */
  amount?: string;
  symbol?: string;
};

export type LendingMarketAsset = {
  decimals: number;
  symbol: string;
};

type ApplFields = {
  applicationId?: number | bigint;
  "application-id"?: number | bigint;
};

type IndexedApplLike = {
  id?: unknown;
  roundTime?: number | bigint;
  "round-time"?: number | bigint;
  applicationTransaction?: ApplFields;
  "application-transaction"?: ApplFields;
};

function finiteId(value: number | bigint | undefined): number | null {
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function readIndexedApplTxn(raw: unknown): IndexedApplTxn | null {
  if (!raw || typeof raw !== "object") return null;
  const tx = raw as IndexedApplLike;
  if (typeof tx.id !== "string" || !tx.id) return null;

  const applicationId = finiteId(
    tx.applicationTransaction?.applicationId ??
      tx["application-transaction"]?.["application-id"]
  );
  if (applicationId == null || applicationId <= 0) return null;

  const roundTimeSec =
    finiteId(tx.roundTime ?? tx["round-time"]) ?? 0;

  return {
    txId: tx.id,
    applicationId,
    roundTimeSec: roundTimeSec > 0 ? roundTimeSec : 0,
  };
}

const METHOD_SELECTORS: Array<[Uint8Array, LendingCallKind]> = (
  [
    ["deposit(uint64,uint256)uint256", "deposit"],
    ["withdraw(uint64,uint256)uint256", "withdraw"],
    ["borrow(uint64,uint256)uint256", "borrow"],
    ["repay(uint64,uint256)uint256", "repay"],
    ["repay_all(uint64)uint256", "repay"],
  ] as const
).map(([signature, kind]) => [
  algosdk.ABIMethod.fromSignature(signature).getSelector(),
  kind,
]);

type NoteCarrier = {
  note?: unknown;
  innerTxns?: unknown[];
  "inner-txns"?: unknown[];
  applicationArgs?: unknown[];
  "application-args"?: unknown[];
};

function bytesOf(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
    return Uint8Array.from(value);
  }
  if (typeof value === "string" && value.length > 0) {
    try {
      const binary = atob(value);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
      return out;
    } catch {
      return null;
    }
  }
  return null;
}

function noteText(note: unknown): string {
  if (typeof note === "string" && note.includes("lending ")) return note.trim();
  const bytes = bytesOf(note);
  if (!bytes || bytes.length === 0) return "";
  return new TextDecoder().decode(bytes).trim();
}

function collectNotes(raw: unknown, depth = 0): string[] {
  if (!raw || typeof raw !== "object" || depth > 4) return [];
  const tx = raw as NoteCarrier;
  const notes: string[] = [];
  const text = noteText(tx.note);
  if (text) notes.push(text);
  const inners = tx.innerTxns ?? tx["inner-txns"] ?? [];
  if (Array.isArray(inners)) {
    for (const inner of inners) notes.push(...collectNotes(inner, depth + 1));
  }
  return notes;
}

function trimAmount(amount: string): string {
  if (!amount.includes(".")) return amount;
  return amount.replace(/0+$/, "").replace(/\.$/, "");
}

function cleanSymbol(symbol: string): string {
  return symbol.replace(/[^A-Za-z0-9]/g, "");
}

/**
 * Pool app calls are noted `lending deposit 1.5 USDC` (withdraw includes
 * underlying). Submitted groups keep that text after an arccjs prefix:
 * `arccjs-v2.10.6:u custom lending deposit 1.000000 USDC`.
 */
export function classifyLendingNote(note: string): {
  kind: LendingCallKind;
  amount?: string;
  symbol?: string;
} {
  const text = note.trim();
  const rich = text.match(
    /lending (deposit|withdraw|borrow|repay)\s+([0-9]+(?:\.[0-9]+)?)\s+(\S+)/i
  );
  if (rich) {
    const kind = rich[1].toLowerCase() as LendingCallKind;
    const underlying = text.match(
      /\(underlying:\s*([0-9]+(?:\.[0-9]+)?)\s+(\S+)/i
    );
    if (kind === "withdraw" && underlying) {
      return {
        kind,
        amount: trimAmount(underlying[1]),
        symbol: cleanSymbol(underlying[2]),
      };
    }
    const symbol = cleanSymbol(rich[3]);
    return {
      kind,
      amount: trimAmount(rich[2]),
      symbol: symbol || undefined,
    };
  }
  const bare = text.match(/lending (deposit|withdraw|borrow|repay)\b/i);
  if (bare) {
    return { kind: bare[1].toLowerCase() as LendingCallKind };
  }
  return { kind: "activity" };
}

/** Human amount from an atomic uint, trimming trailing zeros. */
export function formatAtomicAmount(atomic: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return atomic.toString();
  }
  const negative = atomic < 0n;
  const value = negative ? -atomic : atomic;
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = value % scale;
  const body =
    fraction === 0n
      ? whole.toString()
      : `${whole}.${fraction
          .toString()
          .padStart(decimals, "0")
          .replace(/0+$/, "")}`;
  return negative ? `-${body}` : body;
}

function uintFromArg(value: unknown): bigint | null {
  const bytes = bytesOf(value);
  if (!bytes || bytes.length === 0 || bytes.length > 32) return null;
  let n = 0n;
  for (const byte of bytes) n = (n << 8n) + BigInt(byte);
  return n;
}

function applicationArgsOf(raw: unknown): unknown[] | null {
  if (!raw || typeof raw !== "object") return null;
  const tx = raw as NoteCarrier & {
    applicationTransaction?: NoteCarrier;
    "application-transaction"?: NoteCarrier;
  };
  const appl = tx.applicationTransaction ?? tx["application-transaction"];
  const args =
    appl?.applicationArgs ??
    appl?.["application-args"] ??
    tx.applicationArgs ??
    tx["application-args"];
  return Array.isArray(args) ? args : null;
}

/**
 * Market id is the token contract application id on `borrow(uint64,uint256)`.
 * Match it to the pool's token so the atomic amount uses that token's decimals.
 */
export function lendingMarketAssetLookup(
  networkId: NetworkId,
  poolId: string
): (marketId: number) => LendingMarketAsset | null {
  const tokens = getAllTokens(networkId).filter(
    (token) => String(token.poolId ?? "") === String(poolId)
  );
  return (marketId: number) => {
    const token = tokens.find(
      (row) => String(row.contractId ?? "") === String(marketId)
    );
    if (!token || !Number.isInteger(token.decimals) || token.decimals < 0) {
      return null;
    }
    return { decimals: token.decimals, symbol: token.symbol };
  };
}

function kindFromSelector(raw: unknown): LendingCallKind | null {
  if (!raw || typeof raw !== "object") return null;
  const tx = raw as NoteCarrier & {
    applicationTransaction?: NoteCarrier;
    "application-transaction"?: NoteCarrier;
  };
  const appl = tx.applicationTransaction ?? tx["application-transaction"];
  const args =
    appl?.applicationArgs ??
    appl?.["application-args"] ??
    tx.applicationArgs ??
    tx["application-args"];
  const first = bytesOf(Array.isArray(args) ? args[0] : undefined);
  if (!first) return null;
  for (const [selector, kind] of METHOD_SELECTORS) {
    if (first.length === selector.length && first.every((b, i) => b === selector[i])) {
      return kind;
    }
  }
  return null;
}

export function describeIndexedLendingCall(
  raw: unknown,
  assetForMarket?: (marketId: number) => LendingMarketAsset | null
): DescribedLendingCall | null {
  const base = readIndexedApplTxn(raw);
  if (!base) return null;

  let best: { kind: LendingCallKind; amount?: string; symbol?: string } = {
    kind: "activity",
  };
  for (const note of collectNotes(raw)) {
    const classified = classifyLendingNote(note);
    if (classified.kind === "activity") continue;
    best = classified;
    if (classified.amount) break;
  }
  if (best.kind === "activity") {
    const fromSelector = kindFromSelector(raw);
    if (fromSelector) best = { kind: fromSelector };
  }
  // Notes already carry deposit and withdraw amounts. Borrow and repay do not.
  if (
    !best.amount &&
    (best.kind === "borrow" || best.kind === "repay") &&
    assetForMarket
  ) {
    const args = applicationArgsOf(raw);
    const marketId = args ? uintFromArg(args[1]) : null;
    const atomic = args ? uintFromArg(args[2]) : null;
    if (
      marketId != null &&
      atomic != null &&
      marketId > 0n &&
      marketId <= BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      const asset = assetForMarket(Number(marketId));
      if (asset) {
        best = {
          ...best,
          amount: formatAtomicAmount(atomic, asset.decimals),
          symbol: asset.symbol,
        };
      }
    }
  }

  return {
    ...base,
    kind: best.kind,
    amount: best.amount,
    symbol: best.symbol,
  };
}
