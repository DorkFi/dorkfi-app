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

/** 6-decimal atomic units → human USDC number. */
export function atomicToUsdc(atomic: bigint): number {
  return Number(atomic) / 1_000_000;
}

/** Human string with up to 6 decimals, no trailing zeros. */
export function atomicToUsdcString(atomic: bigint): string {
  const neg = atomic < 0n;
  const abs = neg ? -atomic : atomic;
  const whole = abs / 1_000_000n;
  const frac = abs % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  const body = fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString();
  return neg ? `-${body}` : body;
}

/**
 * Minimum Base USDC to send so Aramid credits at least `destinationAtomic`
 * on Algorand after the 1.001 floor.
 */
export function aramidSendForDestination(destinationAtomic: bigint): bigint {
  if (destinationAtomic <= 0n) return 0n;
  let send = (destinationAtomic * 1001n + 999n) / 1000n;
  while (splitAramidFee(send).destinationAmount < destinationAtomic) {
    send += 1n;
  }
  return send;
}
