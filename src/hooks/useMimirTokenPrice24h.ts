import { useState, useEffect, useCallback } from "react";
import { MimirApiService } from "@/services/mimirApi";
import type { PriceDataPoint } from "@/types/mimirTypes";

/** Lending assets quoted vs themselves / USD stable — no meaningful Mimir pair. */
const STABLE_ASSET_SYMBOLS = new Set(
  ["USDC", "USDT", "DAI", "aUSDC", "XUSD"].map((s) => s.toUpperCase())
);

function parseTs(t: string): number {
  const n = Date.parse(t);
  return Number.isFinite(n) ? n : 0;
}

function computeChange24h(sorted: PriceDataPoint[]): number {
  if (sorted.length < 2) return 0;
  const first = sorted[0]!.price;
  const last = sorted[sorted.length - 1]!.price;
  if (!(first > 0) || !Number.isFinite(last)) return 0;
  return ((last - first) / first) * 100;
}

export interface TokenPrice24hPoint {
  time: number;
  price: number;
}

export interface UseMimirTokenPrice24hResult {
  priceChange24h: number;
  priceHistory: TokenPrice24hPoint[];
  isLoading: boolean;
  error: string | null;
}

/**
 * 24h USD-ish price series from Mimir (token vs USDC) for sparkline + % change.
 * Fetches only when `enabled` (e.g. modal open).
 */
export function useMimirTokenPrice24h(
  symbol: string,
  enabled: boolean
): UseMimirTokenPrice24hResult {
  const [priceChange24h, setPriceChange24h] = useState(0);
  const [priceHistory, setPriceHistory] = useState<TokenPrice24hPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch24h = useCallback(async () => {
    if (!enabled || !symbol?.trim()) {
      setPriceChange24h(0);
      setPriceHistory([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const upper = symbol.trim().toUpperCase();
    if (STABLE_ASSET_SYMBOLS.has(upper)) {
      setPriceChange24h(0);
      setPriceHistory([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const points = await MimirApiService.getPriceHistory(
        symbol.trim(),
        "USDC",
        "1h",
        "24h"
      );
      const sorted = [...points].sort(
        (a, b) => parseTs(a.timestamp) - parseTs(b.timestamp)
      );
      const history: TokenPrice24hPoint[] = sorted.map((p) => ({
        time: parseTs(p.timestamp),
        price: p.price,
      }));
      setPriceChange24h(computeChange24h(sorted));
      setPriceHistory(history);
    } catch (e) {
      setPriceChange24h(0);
      setPriceHistory([]);
      setError(e instanceof Error ? e.message : "Failed to load 24h price");
    } finally {
      setIsLoading(false);
    }
  }, [symbol, enabled]);

  useEffect(() => {
    void fetch24h();
  }, [fetch24h]);

  return { priceChange24h, priceHistory, isLoading, error };
}
