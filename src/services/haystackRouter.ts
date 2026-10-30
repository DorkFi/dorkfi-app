/**
 * Haystack Order Router client for Chub / Easy Swap.
 * @see https://txnlab.gitbook.io/haystack-router
 */
import { RouterClient, type SwapQuote } from "@txnlab/haystack-router";
import type { NetworkId } from "@/config";
import { getNetworkConfig } from "@/config";

/** Free-tier key (60 req/min). Override with VITE_HAYSTACK_API_KEY for production. */
const FREE_TIER_API_KEY = "1b72df7e-1131-4449-8ce1-29b79dd3f51e";

function resolveApiKey(): string {
  const fromEnv =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_HAYSTACK_API_KEY as string | undefined)
      : undefined;
  return fromEnv?.trim() || FREE_TIER_API_KEY;
}

/**
 * Haystack Router is Algorand-mainnet oriented. Return false on unsupported nets.
 */
export function isHaystackSwapSupported(networkId: NetworkId): boolean {
  return networkId === "algorand-mainnet";
}

export function createHaystackRouterClient(
  networkId: NetworkId
): RouterClient | null {
  if (!isHaystackSwapSupported(networkId)) return null;

  const net = getNetworkConfig(networkId);
  const rpcUrl = net.rpcUrl || "https://mainnet-api.4160.nodely.dev";
  const port = net.rpcPort ?? (rpcUrl.includes("https") ? 443 : 80);

  return new RouterClient({
    apiKey: resolveApiKey(),
    algodUri: rpcUrl.endsWith("/") ? rpcUrl : `${rpcUrl}/`,
    algodToken: net.rpcToken ?? "",
    algodPort: port,
    autoOptIn: true,
  });
}

/** Subset of RouterClient used to attach an output-ASA opt-in before execute. */
export type HaystackOutputOptInClient = {
  needsAssetOptIn: (
    address: string,
    assetId: number | bigint
  ) => Promise<boolean>;
  newQuote: (params: {
    fromASAID: number;
    toASAID: number;
    amount: bigint;
    type: "fixed-input";
    address: string;
    optIn: true;
  }) => Promise<SwapQuote>;
};

/**
 * Haystack only prepends the output-ASA opt-in when the quote was fetched with
 * `optIn: true`. Requote at sign time if the swapper still has no holding.
 * ALGO (asset 0) never needs an opt-in.
 */
export async function quoteWithOutputAssetOptIn(args: {
  client: HaystackOutputOptInClient;
  quote: SwapQuote;
  address: string;
  fromASAID: number;
  toASAID: number;
  amount: bigint;
}): Promise<SwapQuote> {
  if (args.toASAID === 0) return args.quote;
  const needsOptIn = await args.client.needsAssetOptIn(
    args.address,
    args.toASAID
  );
  if (!needsOptIn) return args.quote;
  return args.client.newQuote({
    fromASAID: args.fromASAID,
    toASAID: args.toASAID,
    amount: args.amount,
    type: "fixed-input",
    address: args.address,
    optIn: true,
  });
}
