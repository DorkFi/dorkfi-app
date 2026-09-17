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
