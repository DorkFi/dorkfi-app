/**
 * Read held amount (base units) from `algod.accountAssetInformation(...).do()` JSON.
 * Algod / algosdk may expose the holding as `asset-holding`, `assetHolding`, or a top-level `amount`.
 */
export function getAccountAssetHoldingAmountAtomic(
  info: unknown
): bigint | null {
  if (info == null || typeof info !== "object") return null;
  const o = info as Record<string, unknown>;
  const readAmount = (obj: unknown): bigint | null => {
    if (obj == null || typeof obj !== "object") return null;
    const n = obj as Record<string, unknown>;
    const a = n.amount;
    if (a == null) return null;
    try {
      return BigInt(String(a));
    } catch {
      return null;
    }
  };
  const nested = o.assetHolding ?? o["asset-holding"];
  return readAmount(nested) ?? readAmount(o);
}
