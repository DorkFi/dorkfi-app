/**
 * Radix Select forbids empty values and is unreliable with bare `"0"`
 * (ALGO’s ASA id). Encode payment choices as stable non-numeric strings.
 */
export function encodeHaystackPaymentSelectValue(
  asaId: number | null
): string {
  if (asaId == null) return "same";
  return `asa:${asaId}`;
}

export function decodeHaystackPaymentSelectValue(
  value: string
): number | null {
  if (value === "same" || value === "") return null;
  const m = /^asa:(-?\d+)$/.exec(value);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
