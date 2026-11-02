import type { XoRate } from "@/lib/easyStart/xoSwap/types";

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
