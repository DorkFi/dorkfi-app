import { useCallback, useEffect, useRef, useState } from "react";
import { getDefaultPriceFeedProvider } from "@/features/longShort/priceFeed/coinbaseProvider";
import type { AssetPriceFeedProvider } from "@/features/longShort/priceFeed/types";
import {
  asPriceToBeat,
  type DisplayPrice,
  type FeedConnectionStatus,
  type LongShortAsset,
  type PricePoint,
  type PriceToBeat,
} from "@/features/longShort/types";

const STALE_MS = 20_000;

export type UseLiveAssetPriceArgs = {
  asset: LongShortAsset;
  marketStartMs: number;
  marketEndMs: number;
  /** Freeze price-to-beat for this market instance. */
  marketKey: string;
  enabled?: boolean;
  provider?: AssetPriceFeedProvider;
};

export type UseLiveAssetPriceResult = {
  displayPrice: DisplayPrice | null;
  priceToBeat: PriceToBeat | null;
  historical: PricePoint[];
  feedStatus: FeedConnectionStatus;
  isStale: boolean;
  lastUpdateMs: number | null;
  error: string | null;
  /** Winning side from display feed only (not settlement). */
  leadingSide: "LONG" | "SHORT" | "FLAT" | null;
  deltaUsd: number | null;
  deltaPct: number | null;
  reloadHistory: () => void;
};

function priceToBeatStorageKey(marketKey: string, startMs: number): string {
  return `dorkfi:ls:ptb:${marketKey}:${startMs}`;
}

function readFrozenPriceToBeat(marketKey: string, startMs: number): PriceToBeat | null {
  try {
    const raw = sessionStorage.getItem(priceToBeatStorageKey(marketKey, startMs));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? asPriceToBeat(n) : null;
  } catch {
    return null;
  }
}

function writeFrozenPriceToBeat(
  marketKey: string,
  startMs: number,
  price: PriceToBeat
): void {
  try {
    sessionStorage.setItem(priceToBeatStorageKey(marketKey, startMs), String(price));
  } catch {
    /* ignore quota */
  }
}

/**
 * Live display-price hook for Long/Short charts.
 * Separates priceToBeat (frozen) from displayPrice (streaming).
 * Never returns a settlement price.
 */
export function useLiveAssetPrice({
  asset,
  marketStartMs,
  marketEndMs,
  marketKey,
  enabled = true,
  provider,
}: UseLiveAssetPriceArgs): UseLiveAssetPriceResult {
  const feed = provider ?? getDefaultPriceFeedProvider();
  const [historical, setHistorical] = useState<PricePoint[]>([]);
  const [displayPrice, setDisplayPrice] = useState<DisplayPrice | null>(null);
  const [priceToBeat, setPriceToBeat] = useState<PriceToBeat | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedConnectionStatus>("connecting");
  const [lastUpdateMs, setLastUpdateMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const histReqId = useRef(0);

  const loadHistory = useCallback(async () => {
    const req = ++histReqId.current;
    try {
      setError(null);
      const points = await feed.fetchHistorical({
        asset,
        startMs: marketStartMs,
        endMs: Math.min(Date.now(), marketEndMs),
      });
      if (req !== histReqId.current) return;
      setHistorical(points);

      let ptb = readFrozenPriceToBeat(marketKey, marketStartMs);
      if (ptb == null && points.length > 0) {
        // Prefer first candle at/after open; else first available
        const first = points[0];
        ptb = asPriceToBeat(Number(first.value));
        writeFrozenPriceToBeat(marketKey, marketStartMs, ptb);
      }
      if (ptb != null) setPriceToBeat(ptb);

      if (points.length > 0) {
        const last = points[points.length - 1];
        setDisplayPrice(last.value);
        setLastUpdateMs(last.time * 1000);
      }
    } catch (err) {
      if (req !== histReqId.current) return;
      setError(err instanceof Error ? err.message : "Failed to load history");
      setFeedStatus("error");
    }
  }, [asset, feed, marketEndMs, marketKey, marketStartMs]);

  useEffect(() => {
    if (!enabled) return;
    void loadHistory();
  }, [enabled, loadHistory]);

  useEffect(() => {
    if (!enabled) return;
    const unsub = feed.subscribeLive(
      asset,
      (price, atMs) => {
        setDisplayPrice(price);
        setLastUpdateMs(atMs);
        setHistorical((prev) => {
          const t = Math.floor(atMs / 1000);
          if (prev.length && prev[prev.length - 1].time === t) {
            const next = prev.slice();
            next[next.length - 1] = { time: t, value: price };
            return next;
          }
          return [...prev, { time: t, value: price }];
        });
        // If history was empty, freeze first live tick as price-to-beat
        setPriceToBeat((existing) => {
          if (existing != null) return existing;
          const frozen = asPriceToBeat(Number(price));
          writeFrozenPriceToBeat(marketKey, marketStartMs, frozen);
          return frozen;
        });
      },
      (status) => {
        if (status === "connecting") setFeedStatus("connecting");
        else if (status === "live") setFeedStatus("live");
        else if (status === "reconnecting") setFeedStatus("reconnecting");
        else setFeedStatus("error");
      }
    );
    return unsub;
  }, [asset, enabled, feed, marketKey, marketStartMs]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const isStale =
    feedStatus === "reconnecting" ||
    feedStatus === "stale" ||
    (lastUpdateMs != null && nowTick - lastUpdateMs > STALE_MS);

  const effectiveStatus: FeedConnectionStatus = isStale
    ? feedStatus === "live"
      ? "stale"
      : feedStatus
    : feedStatus;

  let leadingSide: "LONG" | "SHORT" | "FLAT" | null = null;
  let deltaUsd: number | null = null;
  let deltaPct: number | null = null;
  if (displayPrice != null && priceToBeat != null) {
    deltaUsd = Number(displayPrice) - Number(priceToBeat);
    deltaPct = (deltaUsd / Number(priceToBeat)) * 100;
    if (Math.abs(deltaUsd) < 1e-9) leadingSide = "FLAT";
    else leadingSide = deltaUsd > 0 ? "LONG" : "SHORT";
  }

  return {
    displayPrice,
    priceToBeat,
    historical,
    feedStatus: effectiveStatus,
    isStale,
    lastUpdateMs,
    error,
    leadingSide,
    deltaUsd,
    deltaPct,
    reloadHistory: () => {
      void loadHistory();
    },
  };
}
