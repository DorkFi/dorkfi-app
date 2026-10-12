/**
 * Coinbase-hosted Onramp / Offramp URLs from a CDP session token.
 * @see https://docs.cdp.coinbase.com/onramp/coinbase-hosted-onramp/generating-onramp-url
 */

export type CoinbaseWidgetUrlArgs = {
  sessionToken: string;
  partnerUserRef: string;
  redirectUrl: string;
  amount?: string | number;
};

/** Asset and network pinned on the hosted Coinbase widget. */
export type CoinbaseAssetTarget = {
  network: string;
  asset: string;
};

export const COINBASE_BASE_USDC: CoinbaseAssetTarget = {
  network: "base",
  asset: "USDC",
};

/** Test path: buy ALGO on Algorand. Cash-out can use the same pair. */
export const COINBASE_ALGORAND_ALGO: CoinbaseAssetTarget = {
  network: "algorand",
  asset: "ALGO",
};

/** Query flag on the SimplFi return URL after Coinbase sell. */
export const CB_OFFRAMP_QUERY = "cb_offramp";
/** partnerUserRef on the SimplFi return URL after Coinbase sell. */
export const CB_OFFRAMP_REF_QUERY = "ref";

/** Append return params so /savings can resume the USDC send after Coinbase. */
export function withCoinbaseOfframpReturnQuery(
  redirectUrl: string,
  partnerUserRef: string
): string {
  const url = new URL(redirectUrl);
  url.searchParams.set(CB_OFFRAMP_QUERY, "1");
  url.searchParams.set(CB_OFFRAMP_REF_QUERY, partnerUserRef);
  return url.toString();
}

export function parseCoinbaseOfframpReturnSearch(
  search: string
): { partnerUserRef: string } | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  if (params.get(CB_OFFRAMP_QUERY) !== "1") return null;
  const partnerUserRef = params.get(CB_OFFRAMP_REF_QUERY)?.trim();
  if (!partnerUserRef) return null;
  return { partnerUserRef };
}

function applySharedParams(
  url: URL,
  args: CoinbaseWidgetUrlArgs,
  target: CoinbaseAssetTarget = COINBASE_BASE_USDC
): void {
  url.searchParams.set("sessionToken", args.sessionToken);
  url.searchParams.set("partnerUserRef", args.partnerUserRef);
  url.searchParams.set("redirectUrl", args.redirectUrl);
  url.searchParams.set("defaultNetwork", target.network);
  url.searchParams.set("defaultAsset", target.asset);
}

/** Body for POST /onramp/v1/token. One address, one network, one asset. */
export function coinbaseSessionTokenBody(args: {
  address: string;
  clientIp: string;
  target?: CoinbaseAssetTarget;
}): {
  addresses: { address: string; blockchains: string[] }[];
  clientIp: string;
  assets: string[];
} {
  const target = args.target ?? COINBASE_BASE_USDC;
  return {
    addresses: [{ address: args.address, blockchains: [target.network] }],
    clientIp: args.clientIp,
    assets: [target.asset],
  };
}

/** `buy` is a fiat purchase. `send` moves crypto the user already holds on Coinbase. */
export type CoinbaseOnrampExperience = "buy" | "send";

/** Hosted Coinbase URL. Defaults to a Base USDC buy, the URL reviewers verify. */
export function buildCoinbaseOnrampBuyUrl(
  args: CoinbaseWidgetUrlArgs,
  target: CoinbaseAssetTarget = COINBASE_BASE_USDC,
  experience: CoinbaseOnrampExperience = "buy"
): string {
  const url = new URL("https://pay.coinbase.com/buy/select-asset");
  applySharedParams(url, args, target);
  url.searchParams.set("defaultExperience", experience);
  if (experience === "buy") {
    url.searchParams.set("fiatCurrency", "USD");
    if (args.amount != null && Number(args.amount) > 0) {
      url.searchParams.set("presetFiatAmount", String(args.amount));
    }
  }
  return url.toString();
}

/** Sell Base USDC (cash-out). */
export function buildCoinbaseOfframpSellUrl(
  args: CoinbaseWidgetUrlArgs,
  target: CoinbaseAssetTarget = COINBASE_BASE_USDC
): string {
  const url = new URL("https://pay.coinbase.com/v3/sell/input");
  applySharedParams(url, args, target);
  if (args.amount != null && Number(args.amount) > 0) {
    url.searchParams.set("presetCryptoAmount", String(args.amount));
  }
  return url.toString();
}
