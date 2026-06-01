/**
 * UI threshold for deposit/borrow caps. When utilization reaches this fraction of the cap,
 * the market is shown as "at capacity" and deposit/borrow actions are disabled.
 * 0.95 = 95%.
 */
export const CAP_UTILIZATION_THRESHOLD = 0.95;

/** Tooltip when mint is disabled because borrow cap utilization is near capacity. */
export const MINT_BORROW_CAP_TOOLTIP =
  "Minting temporarily unavailable due to borrow cap utilization";

/**
 * True when market supply is at or over the deposit cap (≥ threshold of max).
 * Both args must be in the same units (e.g. human-readable token amount).
 */
export function isAtDepositCap(totalSupply: number, maxTotalDeposits: number): boolean {
  return maxTotalDeposits > 0 && totalSupply >= maxTotalDeposits * CAP_UTILIZATION_THRESHOLD;
}

/**
 * True when market borrows are at or over the borrow cap (≥ threshold of max).
 * Both args must be in the same units (e.g. human-readable token amount).
 */
export function isAtBorrowCap(totalBorrow: number, maxTotalBorrows: number): boolean {
  return maxTotalBorrows > 0 && totalBorrow >= maxTotalBorrows * CAP_UTILIZATION_THRESHOLD;
}
