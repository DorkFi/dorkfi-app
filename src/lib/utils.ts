import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip trailing zeros after decimal while keeping a non-empty fractional part when present. */
function stripTrailingZerosDecimal(s: string): string {
  if (!s.includes(".")) return s
  return s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.$/, "")
}

/** Round a USD amount to the nearest cent (half-up). */
export function roundUsdToCents(value: number): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Format a USD amount as currency with exactly two fraction digits (e.g. $1,234.56).
 * Rounds to the nearest cent before formatting.
 */
export function formatUsdAmount(value: number): string {
  const rounded = roundUsdToCents(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * WAD (Whale Asset Dollar) targets ~$1. Some pipelines expose the lending oracle as
 * micro-USD per whole token (1_000_000 ⇒ $1.00). Values ≥ 100_000 are treated as
 * that encoding and scaled down (WAD is not expected to trade near $100k per token).
 */
export function normalizeWadUsdPerToken(priceUsd: number): number {
  if (priceUsd == null || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    return priceUsd;
  }
  if (priceUsd >= 100_000) {
    return priceUsd / 1_000_000;
  }
  return priceUsd;
}

/**
 * Format USD price per whole token for UI.
 * - ≥ $1: 2 decimals (e.g. USDC, BTC)
 * - $0.01–$1: 3–4 decimals so mid-priced assets (e.g. UNIT $0.616) are not rounded to cents
 * - < $0.01: enough decimals to avoid showing $0.00 (e.g. VOI)
 */
export function formatUsdPerTokenDisplay(price: number): string {
  if (price == null || !Number.isFinite(price)) return "0.00"
  if (price === 0) return "0.00"

  const abs = Math.abs(price)
  if (abs >= 1) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  if (abs >= 0.01) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 4,
    })
  }

  const dust = stripTrailingZerosDecimal(price.toFixed(8))
  if (dust !== "0" && dust !== "0.0") return dust

  return stripTrailingZerosDecimal(price.toExponential(4))
}
