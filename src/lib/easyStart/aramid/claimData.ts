import {
  ARAMID_CHAIN_INDEXER_HOSTS,
  ARAMID_CLAIM_DATA_PREFIX,
  ARAMID_CLAIMS_ADDRESS,
} from "@/lib/easyStart/aramid/constants";

export type AramidChainInfo = {
  chainId: number;
  tokenId: string;
  amount: string | number;
  addressId: string;
};

export type AramidClaimData = {
  sourceTransactionId: string;
  maxClaimRound: number;
  note?: string;
  signatures: string[];
  sourceChainData: AramidChainInfo;
  destinationChainData: AramidChainInfo;
};

type IndexerTxn = {
  id?: string;
  note?: string;
};

type IndexerAccountTxns = {
  transactions?: IndexerTxn[];
  "next-token"?: string;
};

/** Overall budget for a claim lookup so wait loops never stall on indexers. */
const LOOKUP_MS = 4_000;
const PAGE_LIMIT = 50;

function decodeIndexerNote(note: string | undefined): string | null {
  if (!note) return null;
  try {
    const binary = atob(note);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function isChainInfo(value: unknown): value is AramidChainInfo {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.chainId === "number" &&
    row.tokenId != null &&
    row.amount != null &&
    typeof row.addressId === "string"
  );
}

/** Parse an `aramid-claim-data/v1:j{...}` note if it matches `sourceTxId`. */
export function parseAramidClaimNote(
  decodedNote: string,
  sourceTxId: string
): AramidClaimData | null {
  const want = sourceTxId.trim();
  if (!want || !decodedNote.startsWith(ARAMID_CLAIM_DATA_PREFIX)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedNote.slice(ARAMID_CLAIM_DATA_PREFIX.length));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Record<string, unknown>;
  if (String(row.sourceTransactionId ?? "") !== want) return null;
  if (!Array.isArray(row.signatures) || row.signatures.length === 0) return null;
  if (!isChainInfo(row.sourceChainData) || !isChainInfo(row.destinationChainData)) {
    return null;
  }
  const maxClaimRound = Number(row.maxClaimRound);
  if (!Number.isFinite(maxClaimRound)) return null;
  return {
    sourceTransactionId: want,
    maxClaimRound,
    note: typeof row.note === "string" ? row.note : "",
    signatures: row.signatures.map((s) => String(s)),
    sourceChainData: row.sourceChainData,
    destinationChainData: row.destinationChainData,
  };
}

async function fetchIndexerPage(
  host: string,
  signal: AbortSignal
): Promise<IndexerAccountTxns> {
  const prefixB64 = btoa(ARAMID_CLAIM_DATA_PREFIX);
  const params = new URLSearchParams({
    limit: String(PAGE_LIMIT),
    "note-prefix": prefixB64,
  });
  const url = `${host}/v2/accounts/${ARAMID_CLAIMS_ADDRESS}/transactions?${params}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`AramidChain indexer ${res.status}`);
  }
  return (await res.json()) as IndexerAccountTxns;
}

function findClaimInPage(
  body: IndexerAccountTxns,
  sourceTxId: string
): AramidClaimData | null {
  for (const txn of body.transactions ?? []) {
    const decoded = decodeIndexerNote(txn.note);
    if (!decoded) continue;
    const claim = parseAramidClaimNote(decoded, sourceTxId);
    if (claim) return claim;
  }
  return null;
}

/**
 * Find soldier-signed Base claim data for an Algorand source axfer id.
 * Returns null if soldiers have not published yet (or indexers are down).
 * Recent claims are the newest page; we only fetch that, in parallel, with a
 * short budget so USDC polling is never blocked on a slow indexer.
 */
export async function fetchAramidClaimData(
  sourceTxId: string,
  signal?: AbortSignal
): Promise<AramidClaimData | null> {
  const want = sourceTxId.trim();
  if (!want) return null;
  if (signal?.aborted) return null;

  const ac = new AbortController();
  const onOuterAbort = () => ac.abort();
  signal?.addEventListener("abort", onOuterAbort, { once: true });

  const lookup = new Promise<AramidClaimData | null>((resolve) => {
    let remaining = ARAMID_CHAIN_INDEXER_HOSTS.length;
    let settled = false;
    const finish = (value: AramidClaimData | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const finishNull = () => {
      remaining -= 1;
      if (remaining <= 0) finish(null);
    };
    for (const host of ARAMID_CHAIN_INDEXER_HOSTS) {
      fetchIndexerPage(host, ac.signal)
        .then((body) => {
          const claim = findClaimInPage(body, want);
          if (claim) {
            finish(claim);
            return;
          }
          finishNull();
        })
        .catch(() => {
          finishNull();
        });
    }
  });

  const timeout = new Promise<null>((resolve) => {
    const timer = setTimeout(() => resolve(null), LOOKUP_MS);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(null);
    };
    ac.signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([lookup, timeout]);
  } catch {
    return null;
  } finally {
    ac.abort();
    signal?.removeEventListener("abort", onOuterAbort);
  }
}
