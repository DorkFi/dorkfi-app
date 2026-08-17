import type { LongShortAsset, LongShortMarketDef } from "./types";

/** Coinbase Exchange product ids for the UI price feed (not settlement). */
export const COINBASE_PRODUCT_BY_ASSET: Record<LongShortAsset, string> = {
  BTC: "BTC-USD",
  ALGO: "ALGO-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
};

/**
 * Env override for candle/ticker REST host.
 * Default: Coinbase Exchange public API (no key).
 */
export function getPriceFeedRestBase(): string {
  return (
    (import.meta.env.VITE_LONGSHORT_PRICE_REST_URL as string | undefined)?.trim() ||
    "https://api.exchange.coinbase.com"
  );
}

export function getPriceFeedWsUrl(): string {
  return (
    (import.meta.env.VITE_LONGSHORT_PRICE_WS_URL as string | undefined)?.trim() ||
    "wss://ws-feed.exchange.coinbase.com"
  );
}

export const LONG_SHORT_MARKETS: LongShortMarketDef[] = [
  {
    id: "algo-daily",
    title: "ALGO · Daily",
    blurb: "ALGO up or down vs daily open",
    asset: "ALGO",
    horizon: "daily",
  },
  {
    id: "btc-daily",
    title: "BTC · Daily",
    blurb: "BTC up or down vs daily open",
    asset: "BTC",
    horizon: "daily",
  },
  {
    id: "btc-15m",
    title: "BTC · 15 min",
    blurb: "Short-horizon BTC direction",
    asset: "BTC",
    horizon: "15m",
  },
];

export const PERP_ASSETS = ["BTC", "ALGO"] as const;
