/**
 * Aramid deducts a ~0.1% fee from the amount sent.
 * Live Base `lockTokens` uses the documented 1.001 floor:
 * destination = floor(total / 1.001) = total * 1000 / 1001 (truncate).
 */
export function splitAramidFee(totalAtomic: bigint): {
  feeAmount: bigint;
  destinationAmount: bigint;
} {
  if (totalAtomic <= 0n) {
    throw new Error("Amount must be positive");
  }
  const destinationAmount = (totalAtomic * 1000n) / 1001n;
  const feeAmount = totalAtomic - destinationAmount;
  if (destinationAmount <= 0n || feeAmount < 0n) {
    throw new Error("Amount is too small to bridge");
  }
  return { feeAmount, destinationAmount };
}

/** Human USDC string → 6-decimal atomic units. */
export function usdcToAtomic(amountHuman: string): bigint {
  const n = Number(amountHuman);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Invalid USDC amount");
  }
  return BigInt(Math.round(n * 1_000_000));
}
