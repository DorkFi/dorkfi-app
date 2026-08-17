import type { MarketHorizon } from "./types";

export type MarketWindow = {
  /** Inclusive start (ms) */
  startMs: number;
  /** Exclusive end (ms) */
  endMs: number;
};

/** UTC midnight of the given instant. */
function utcDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Authoritative market window from wall-clock timestamps
 * (not "time since page load").
 */
export function getMarketWindow(
  horizon: MarketHorizon,
  nowMs: number = Date.now()
): MarketWindow {
  if (horizon === "daily") {
    const startMs = utcDayStart(nowMs);
    return { startMs, endMs: startMs + 24 * 60 * 60 * 1000 };
  }
  // Align to 15-minute UTC buckets
  const bucket = 15 * 60 * 1000;
  const startMs = Math.floor(nowMs / bucket) * bucket;
  return { startMs, endMs: startMs + bucket };
}

export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
