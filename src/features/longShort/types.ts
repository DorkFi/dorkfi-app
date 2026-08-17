/**
 * Long/Short market price types.
 * Display feed prices must never be used as settlement.
 */

/** Live / historical UI price from the exchange feed (not settlement). */
export type DisplayPrice = number & { readonly __brand: "DisplayPrice" };

/** Frozen opening/target price for the market window (immutable once set). */
export type PriceToBeat = number & { readonly __brand: "PriceToBeat" };

/** Authoritative oracle/protocol settlement price (never from browser WS alone). */
export type SettlementPrice = number & { readonly __brand: "SettlementPrice" };

export function asDisplayPrice(n: number): DisplayPrice {
  return n as DisplayPrice;
}

export function asPriceToBeat(n: number): PriceToBeat {
  return n as PriceToBeat;
}

export function asSettlementPrice(n: number): SettlementPrice {
  return n as SettlementPrice;
}

export type LongShortAsset = "BTC" | "ALGO" | "ETH" | "SOL";

export type MarketHorizon = "daily" | "15m";

export type MarketStatus = "live" | "ended" | "loading";

export type FeedConnectionStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "stale"
  | "error";

export type PricePoint = {
  /** Unix seconds */
  time: number;
  value: DisplayPrice;
};

export type LiveAssetPriceState = {
  asset: LongShortAsset;
  displayPrice: DisplayPrice | null;
  historical: PricePoint[];
  feedStatus: FeedConnectionStatus;
  lastUpdateMs: number | null;
  error: string | null;
};

export type LongShortMarketDef = {
  id: string;
  title: string;
  blurb: string;
  asset: LongShortAsset;
  horizon: MarketHorizon;
  /** Coming-soon cards stay on the grid only. */
  soon?: boolean;
};
