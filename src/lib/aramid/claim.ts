import { loadAramidConfig } from "@/lib/aramid/config";
import { ARAMID_CHAIN, type AramidChainId, type AramidClaimData } from "@/lib/aramid/types";

const INDEXER = "https://aramid-indexer-public.de.nodes.biatec.io";
const PREFIX = "aramid-claim-data/v1:j";
const CONFIRM_PREFIX = "aramid-confirm/v1:j";

const AVM_INDEXER: Partial<Record<AramidChainId, string>> = {
  [ARAMID_CHAIN.algorand]: "https://mainnet-idx.4160.nodely.dev",
  [ARAMID_CHAIN.voi]: "https://mainnet-idx.voi.nodely.dev",
};

function decodeNote(note: string): string {
  try {
    return atob(note);
  } catch {
    return note;
  }
}

/** Look through recent claim-log transactions for a source transaction id. */
export async function findAramidClaim(args: {
  claimsAddress: string;
  sourceTransactionId: string;
}): Promise<AramidClaimData | null> {
  let next: string | undefined;
  for (let page = 0; page < 4; page += 1) {
    const url = new URL(
      `/v2/accounts/${args.claimsAddress}/transactions`,
      INDEXER
    );
    url.searchParams.set("limit", "100");
    if (next) url.searchParams.set("next", next);
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      transactions?: Array<{ note?: string }>;
      "next-token"?: string;
    };
    for (const tx of body.transactions ?? []) {
      if (!tx.note) continue;
      const text = decodeNote(tx.note);
      if (!text.startsWith(PREFIX)) continue;
      const parsed = JSON.parse(text.slice(PREFIX.length)) as AramidClaimData;
      if (parsed.sourceTransactionId === args.sourceTransactionId) {
        return parsed;
      }
    }
    next = body["next-token"];
    if (!next) break;
  }
  return null;
}

export function matchAramidConfirmTx(
  transactions: Array<{ id?: string; note?: string }>,
  sourceTransactionId: string
): string | null {
  for (const tx of transactions) {
    if (!tx.id || !tx.note) continue;
    const text = decodeNote(tx.note);
    if (!text.startsWith(CONFIRM_PREFIX)) continue;
    try {
      const parsed = JSON.parse(text.slice(CONFIRM_PREFIX.length)) as {
        sourceTxId?: string;
      };
      if (parsed.sourceTxId === sourceTransactionId) return tx.id;
    } catch {
      continue;
    }
  }
  return null;
}

/** Destination payout whose note names this source transaction. */
export async function findAramidDestinationConfirm(args: {
  destinationChain: AramidChainId;
  sourceTransactionId: string;
}): Promise<string | null> {
  const indexer = AVM_INDEXER[args.destinationChain];
  if (!indexer) return null;
  const config = await loadAramidConfig();
  const bridge = config.chains[String(args.destinationChain)]?.address;
  if (!bridge) return null;
  let next: string | undefined;
  for (let page = 0; page < 3; page += 1) {
    const url = new URL(`/v2/transactions`, indexer);
    url.searchParams.set("address", bridge);
    url.searchParams.set("limit", "100");
    if (next) url.searchParams.set("next", next);
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      transactions?: Array<{ id?: string; note?: string }>;
      "next-token"?: string;
    };
    const match = matchAramidConfirmTx(
      body.transactions ?? [],
      args.sourceTransactionId
    );
    if (match) return match;
    next = body["next-token"];
    if (!next) break;
  }
  return null;
}
