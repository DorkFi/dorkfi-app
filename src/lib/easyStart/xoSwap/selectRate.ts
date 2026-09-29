import type { XoRate } from "@/lib/easyStart/xoSwap/types";

function isLiveRate(rate: XoRate, nowMs: number): boolean {
  return typeof rate.expiry !== "number" || rate.expiry > nowMs;
}

/** Envelope of live fixed rates — used to disable confirm below min or above max. */
export function xoRateBounds(
  rates: XoRate[],
  nowMs = Date.now()
): { min: number; max: number } | null {
  let min: number | null = null;
  let max: number | null = null;
  for (const rate of rates) {
    if (!isLiveRate(rate, nowMs)) continue;
    const rMin = rate.min?.value;
    const rMax = rate.max?.value;
    if (typeof rMin !== "number" || typeof rMax !== "number") continue;
    min = min == null ? rMin : Math.min(min, rMin);
    max = max == null ? rMax : Math.max(max, rMax);
  }
  if (min == null || max == null) return null;
  return { min, max };
}

/** Pick the best fixed rate for `fromAmount` and compute guaranteed `toAmount`. */
export function selectBestXoRate(
  rates: XoRate[],
  fromAmount: number,
  nowMs = Date.now()
): { rate: XoRate; toAmount: number } | null {
  if (!Number.isFinite(fromAmount) || fromAmount <= 0) return null;

  let best: { rate: XoRate; toAmount: number } | null = null;

  for (const rate of rates) {
    const min = rate.min?.value;
    const max = rate.max?.value;
    const multiplier = rate.amount?.value;
    const minerFee = rate.minerFee?.value ?? 0;
    if (
      typeof min !== "number" ||
      typeof max !== "number" ||
      typeof multiplier !== "number"
    ) {
      continue;
    }
    if (fromAmount < min || fromAmount > max) continue;
    if (typeof rate.expiry === "number" && rate.expiry <= nowMs) continue;

    const toAmount = fromAmount * multiplier - minerFee;
    if (!Number.isFinite(toAmount) || toAmount <= 0) continue;
    if (!best || toAmount > best.toAmount) {
      best = { rate, toAmount };
    }
  }

  return best;
}
