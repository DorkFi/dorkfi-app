/** Same floor EasyStartWithdrawSheet uses before Cash out is enabled. */
export const CASH_OUT_MIN_USD = 0.01;

export type CashOutEmptyBucket = "earn" | "algorand" | "empty";

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Which empty-state to show when Base is not cashable.
 * Earn wins when it still holds a cashable amount. Algorand is named only
 * once Earn is effectively empty, so a failed swap is not described as
 * “withdraw from Earn”.
 */
export function cashOutEmptyBucket(input: {
  baseUsd: number;
  earnUsd: number;
  algorandUsd: number;
}): CashOutEmptyBucket | null {
  if (nonNegative(input.baseUsd) > CASH_OUT_MIN_USD) return null;
  if (nonNegative(input.earnUsd) > CASH_OUT_MIN_USD) return "earn";
  if (nonNegative(input.algorandUsd) > CASH_OUT_MIN_USD) return "algorand";
  return "empty";
}

export function cashOutEmptyDescription(input: {
  consumerCopy: boolean;
  baseUsd: number;
  earnUsd: number;
  algorandUsd: number;
}): string | null {
  const bucket = cashOutEmptyBucket(input);
  if (bucket == null) return null;
  if (input.consumerCopy) {
    if (bucket === "earn") {
      return "Nothing available to cash out. Withdraw from Earn first.";
    }
    if (bucket === "algorand") {
      return "This balance is on Algorand. Move it to your account first.";
    }
    return "Nothing to cash out.";
  }
  if (bucket === "earn") {
    return "No USDC available to cash out. Withdraw from savings first.";
  }
  if (bucket === "algorand") {
    return "USDC is on Algorand. Move it to Base before cashing out.";
  }
  return "Nothing to cash out.";
}
