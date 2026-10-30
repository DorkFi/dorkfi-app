import type { AramidPublicConfig } from "@/lib/aramid/types";

const CONFIG_PATH = "/api/aramid-config";
const INDEXER =
  "https://aramid-indexer-public.de.nodes.biatec.io";
const CONFIG_ACCOUNT =
  "EGRNQAIVBY4O47XJNCLIYZGSHBQIKYC25VWEHBQVFRUACCXBR7TDSKISSA";
const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs",
  "https://w3s.link/ipfs",
  "https://ipfs.io/ipfs",
];

let cached: { at: number; config: AramidPublicConfig } | null = null;
const CACHE_MS = 5 * 60 * 1000;

function isConfig(value: unknown): value is AramidPublicConfig {
  if (!value || typeof value !== "object") return false;
  const row = value as AramidPublicConfig;
  return Boolean(row.chains && row.chains2tokens);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Bridge routes request failed (${res.status})`);
  }
  return res.json();
}

async function fetchFromIndexer(): Promise<AramidPublicConfig> {
  const url = `${INDEXER}/v2/accounts/${CONFIG_ACCOUNT}/transactions?limit=10`;
  const body = (await fetchJson(url)) as {
    transactions?: Array<{ note?: string }>;
  };
  for (const tx of body.transactions ?? []) {
    if (!tx.note) continue;
    const note = atob(tx.note);
    if (!note.startsWith("aramid-config/v1:j")) continue;
    const parsed = JSON.parse(note.slice("aramid-config/v1:j".length)) as {
      ipfsHash?: string;
    };
    if (!parsed.ipfsHash) continue;
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const config = await fetchJson(`${gateway}/${parsed.ipfsHash}`);
        if (isConfig(config)) return config;
      } catch {
        // Try the next gateway.
      }
    }
  }
  throw new Error("Could not load bridge routes.");
}

/** Live Aramid route table. Prefer the app proxy, then the public indexer. */
export async function loadAramidConfig(): Promise<AramidPublicConfig> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  let config: AramidPublicConfig;
  try {
    const direct = await fetchJson(CONFIG_PATH);
    if (!isConfig(direct)) throw new Error("Bridge route table was empty.");
    config = direct;
  } catch {
    config = await fetchFromIndexer();
  }
  cached = { at: Date.now(), config };
  return config;
}
