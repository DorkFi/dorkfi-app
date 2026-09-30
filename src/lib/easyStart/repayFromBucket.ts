import { DEFAULT_LIQUIDATION_THRESHOLD_DECIMAL } from "@/utils/userHealth";

export type RepaySource = "algorand" | "base" | "earn";

export const EARN_REPAY_UNSAFE_MESSAGE =
  "Withdrawing that much from Earn would put the loan at risk. Add cash or repay a smaller amount.";

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Largest Earn redeem that keeps health at or above 1.
 * health = (collateral × liquidation threshold) / borrow.
 * A loan with no debt can redeem the full collateral.
 */
export function maxEarnRedeemKeepingLoanSafe(input: {
  collateralUsd: number;
  borrowUsd: number;
  liquidationThreshold?: number;
}): number {
  const collateral = nonNegative(input.collateralUsd);
  const borrow = nonNegative(input.borrowUsd);
  const lt =
    input.liquidationThreshold != null &&
    Number.isFinite(input.liquidationThreshold) &&
    input.liquidationThreshold > 0
      ? input.liquidationThreshold
      : DEFAULT_LIQUIDATION_THRESHOLD_DECIMAL;
  if (collateral <= 0) return 0;
  if (borrow <= 0) return collateral;
  const minCollateral = borrow / lt;
  return Math.max(0, collateral - minCollateral);
}

export function earnRedeemKeepsLoanSafe(input: {
  collateralUsd: number;
  borrowUsd: number;
  redeemUsd: number;
  liquidationThreshold?: number;
}): boolean {
  const redeem = nonNegative(input.redeemUsd);
  return redeem <= maxEarnRedeemKeepingLoanSafe(input) + 1e-6;
}

export function repaySourceLabel(
  source: RepaySource,
  consumerCopy: boolean
): string {
  if (source === "algorand") {
    return consumerCopy ? "Available to move" : "Algorand wallet";
  }
  if (source === "base") return consumerCopy ? "Ready to cash out" : "Base";
  return consumerCopy ? "Earn" : "Savings";
}
