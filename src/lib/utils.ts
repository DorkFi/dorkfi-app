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

/**
 * Format USD price per whole token for UI: 2 decimals when ≥ $0.01; extra decimals
 * when the value would otherwise show as $0.00 (e.g. VOI).
 */
export function formatUsdPerTokenDisplay(price: number): string {
  if (price == null || !Number.isFinite(price)) return "0.00"
  if (price === 0) return "0.00"

  const abs = Math.abs(price)
  if (abs >= 0.01) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  for (let d = 3; d <= 10; d++) {
    const s = price.toFixed(d)
    if (parseFloat(s) !== 0) {
      return stripTrailingZerosDecimal(s)
    }
  }

  return stripTrailingZerosDecimal(price.toExponential(4))
}
