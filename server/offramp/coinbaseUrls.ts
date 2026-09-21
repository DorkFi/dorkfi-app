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

/** Query flag on the SimplFi return URL after Coinbase sell. */
export const CB_OFFRAMP_QUERY = "cb_offramp";
/** partnerUserRef on the SimplFi return URL after Coinbase sell. */
export const CB_OFFRAMP_REF_QUERY = "ref";

/** Append return params so /portfolio can resume the USDC send after Coinbase. */
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
  args: CoinbaseWidgetUrlArgs
): void {
  url.searchParams.set("sessionToken", args.sessionToken);
  url.searchParams.set("partnerUserRef", args.partnerUserRef);
  url.searchParams.set("redirectUrl", args.redirectUrl);
  url.searchParams.set("defaultNetwork", "base");
  url.searchParams.set("defaultAsset", "USDC");
}

/** Fiat buy of Base USDC — this is the URL Coinbase Full Access reviewers verify. */
export function buildCoinbaseOnrampBuyUrl(args: CoinbaseWidgetUrlArgs): string {
  const url = new URL("https://pay.coinbase.com/buy/select-asset");
  applySharedParams(url, args);
  url.searchParams.set("fiatCurrency", "USD");
  url.searchParams.set("defaultExperience", "buy");
  if (args.amount != null && Number(args.amount) > 0) {
    url.searchParams.set("presetFiatAmount", String(args.amount));
  }
  return url.toString();
}

/** Sell Base USDC (cash-out). */
export function buildCoinbaseOfframpSellUrl(
  args: CoinbaseWidgetUrlArgs
): string {
  const url = new URL("https://pay.coinbase.com/v3/sell/input");
  applySharedParams(url, args);
  if (args.amount != null && Number(args.amount) > 0) {
    url.searchParams.set("presetCryptoAmount", String(args.amount));
  }
  return url.toString();
}
