/**
 * UI price-feed provider interface.
 * Implementations power charts only — never settlement.
 */

import type { DisplayPrice, LongShortAsset, PricePoint } from "./types";

export type HistoricalPriceQuery = {
  asset: LongShortAsset;
  startMs: number;
  endMs: number;
  /** Candle size in seconds (Coinbase: 60, 300, 900, …). */
  granularitySec?: number;
};

export interface AssetPriceFeedProvider {
  readonly id: string;
  fetchHistorical(query: HistoricalPriceQuery): Promise<PricePoint[]>;
  /**
   * Subscribe to live display prices.
   * Returns an unsubscribe function.
   */
  subscribeLive(
    asset: LongShortAsset,
    onPrice: (price: DisplayPrice, atMs: number) => void,
    onStatus: (status: "connecting" | "live" | "reconnecting" | "error", detail?: string) => void
  ): () => void;
}
