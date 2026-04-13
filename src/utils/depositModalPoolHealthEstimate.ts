import {
  calculateUserHealthFactor,
  normalizeLiquidationThresholdToDecimal,
} from "@/utils/userHealth";
import type { PoolCollateralMarketRow } from "@/utils/poolCollateralMarketRows";

/** Est. HF at or below this (after deposit, capped 3.0) blocks deposit in the modal. */
export const DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX = 1.01;

export type LiquidationThresholdSummaryDeposit = {
  primaryPercent: string;
  secondaryLine: string | null;
  deltaFromPreviousPoolMin: number | null;
  poolCollateralMarkets?: PoolCollateralMarketRow[];
  depLt: number;
  minAfter: number;
  minSup: number;
};

export function buildLiquidationThresholdSummaryForDeposit(
  depLt: number | undefined | null,
  poolCollateralMarkets: PoolCollateralMarketRow[] | undefined,
  poolId: string | undefined
): LiquidationThresholdSummaryDeposit | null {
  if (depLt == null || !Number.isFinite(depLt)) return null;
  if (!poolCollateralMarkets?.length || !poolId) {
    return {
      primaryPercent: depLt.toFixed(1),
      secondaryLine: null,
      deltaFromPreviousPoolMin: null,
      poolCollateralMarkets,
      depLt,
      minAfter: depLt,
      minSup: depLt,
    };
  }
  const minSup = Math.min(
    ...poolCollateralMarkets.map((r) => r.liquidationThresholdPercent)
  );
  const minAfter = Math.min(minSup, depLt);
  const secondaryLine =
    Math.abs(minAfter - depLt) > 1e-6
      ? `This market: ${depLt.toFixed(1)}%`
      : null;
  const deltaFromPreviousPoolMin =
    minAfter < minSup - 1e-6 ? minAfter - minSup : null;
  return {
    primaryPercent: minAfter.toFixed(1),
    secondaryLine,
    deltaFromPreviousPoolMin,
    poolCollateralMarkets,
    depLt,
    minAfter,
    minSup,
  };
}

export type PoolHealthEstimateMeta = {
  value: number | null;
  deltaPercent: number | null;
  /** Pool HF before the simulated action (capped at 3.0), when applicable */
  beforeValue?: number | null;
};

/**
 * Max **additional** borrow (human token amount) such that pool HF stays at or above {@link minHealthFactor},
 * using (collateral × min LT) / total borrows after borrow, with USD notionals from oracle price.
 */
export function maxBorrowTokenAmountForMinEstimatedHealth(
  poolGlobalUserData: {
    totalCollateralValue: number;
    totalBorrowValue: number;
  } | null,
  liquidationSummary: LiquidationThresholdSummaryDeposit | null,
  tokenPrice: number,
  minHealthFactor: number
): number | null {
  if (
    !poolGlobalUserData ||
    !liquidationSummary ||
    !Number.isFinite(tokenPrice) ||
    tokenPrice <= 0 ||
    !Number.isFinite(minHealthFactor) ||
    minHealthFactor <= 0
  ) {
    return null;
  }
  const C = poolGlobalUserData.totalCollateralValue;
  const B = poolGlobalUserData.totalBorrowValue;
  const minLt = liquidationSummary.minAfter;
  if (
    !Number.isFinite(C) ||
    C <= 0 ||
    !Number.isFinite(B) ||
    B < 0 ||
    !Number.isFinite(minLt)
  ) {
    return null;
  }
  const ltDec = normalizeLiquidationThresholdToDecimal(minLt);
  if (!Number.isFinite(ltDec) || ltDec <= 0) return null;

  const maxTotalBorrowUsd = (C * ltDec) / minHealthFactor;
  const maxAdditionalUsd = maxTotalBorrowUsd - B;
  if (!Number.isFinite(maxAdditionalUsd)) return null;
  if (maxAdditionalUsd <= 0) return 0;

  return maxAdditionalUsd / tokenPrice;
}

/**
 * Pool-level HF after deposit vs before (same cap 3.0 as Portfolio).
 * Returns `{ value: null, deltaPercent: null }` when inputs are insufficient.
 */
export function estimatePoolHealthAfterDeposit(
  poolGlobalUserData: {
    totalCollateralValue: number;
    totalBorrowValue: number;
  } | null,
  liquidationSummary: LiquidationThresholdSummaryDeposit | null,
  depositAmount: number,
  tokenPrice: number
): PoolHealthEstimateMeta | null {
  if (poolGlobalUserData == null || liquidationSummary == null) return null;
  const minLtAfter = liquidationSummary.minAfter;
  const ltBefore = liquidationSummary.minSup ?? liquidationSummary.minAfter;
  if (!Number.isFinite(minLtAfter) || !Number.isFinite(ltBefore)) return null;

  const depUsd =
    Math.max(0, Number.isFinite(depositAmount) ? depositAmount : 0) *
    (tokenPrice > 0 && Number.isFinite(tokenPrice) ? tokenPrice : 0);
  const C0 = poolGlobalUserData.totalCollateralValue;
  const borrowUsd = poolGlobalUserData.totalBorrowValue;

  const hfAfterRaw = calculateUserHealthFactor(
    C0 + depUsd,
    borrowUsd,
    minLtAfter,
    "deposit-modal-est-hf-after"
  );
  const hfBeforeRaw = calculateUserHealthFactor(
    C0,
    borrowUsd,
    ltBefore,
    "deposit-modal-est-hf-before"
  );

  const cap = (h: number | null) => (h == null ? null : Math.min(h, 3.0));
  const value = cap(hfAfterRaw);
  const beforeCapped = cap(hfBeforeRaw);

  let deltaPercent: number | null = null;
  if (
    beforeCapped != null &&
    value != null &&
    beforeCapped > 0 &&
    Number.isFinite(beforeCapped)
  ) {
    const pct = ((value - beforeCapped) / beforeCapped) * 100;
    if (Number.isFinite(pct) && Math.abs(pct) > 1e-6) {
      deltaPercent = pct;
    }
  }

  return { value, deltaPercent, beforeValue: beforeCapped };
}

export function shouldBlockDepositForLowEstimatedHealth(
  estimatedValue: number | null | undefined
): boolean {
  return (
    estimatedValue != null &&
    Number.isFinite(estimatedValue) &&
    estimatedValue < DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX
  );
}

/**
 * Pool-level HF after withdrawing collateral vs current (same cap 3.0 as Portfolio).
 */
export function estimatePoolHealthAfterWithdraw(
  poolGlobalUserData: {
    totalCollateralValue: number;
    totalBorrowValue: number;
  } | null,
  liquidationSummary: LiquidationThresholdSummaryDeposit | null,
  withdrawAmount: number,
  tokenPrice: number
): PoolHealthEstimateMeta | null {
  if (poolGlobalUserData == null || liquidationSummary == null) return null;
  const minLt = liquidationSummary.minAfter;
  const ltBefore = liquidationSummary.minSup ?? liquidationSummary.minAfter;
  if (!Number.isFinite(minLt) || !Number.isFinite(ltBefore)) return null;

  const withdrawUsd =
    Math.max(0, Number.isFinite(withdrawAmount) ? withdrawAmount : 0) *
    (tokenPrice > 0 && Number.isFinite(tokenPrice) ? tokenPrice : 0);
  const C0 = poolGlobalUserData.totalCollateralValue;
  const borrowUsd = poolGlobalUserData.totalBorrowValue;

  const collateralAfter = Math.max(0, C0 - withdrawUsd);

  const hfAfterRaw = calculateUserHealthFactor(
    collateralAfter,
    borrowUsd,
    minLt,
    "withdraw-modal-est-hf-after"
  );
  const hfBeforeRaw = calculateUserHealthFactor(
    C0,
    borrowUsd,
    ltBefore,
    "withdraw-modal-est-hf-before"
  );

  const cap = (h: number | null) => (h == null ? null : Math.min(h, 3.0));
  const value = cap(hfAfterRaw);
  const beforeCapped = cap(hfBeforeRaw);

  let deltaPercent: number | null = null;
  if (
    beforeCapped != null &&
    value != null &&
    beforeCapped > 0 &&
    Number.isFinite(beforeCapped)
  ) {
    const pct = ((value - beforeCapped) / beforeCapped) * 100;
    if (Number.isFinite(pct) && Math.abs(pct) > 1e-6) {
      deltaPercent = pct;
    }
  }

  return { value, deltaPercent, beforeValue: beforeCapped };
}

/**
 * Pool-level HF after borrowing more vs current (same cap 3.0 as Portfolio).
 * Collateral unchanged; borrow (USD) increases by borrowAmount × token price.
 */
export function estimatePoolHealthAfterBorrow(
  poolGlobalUserData: {
    totalCollateralValue: number;
    totalBorrowValue: number;
  } | null,
  liquidationSummary: LiquidationThresholdSummaryDeposit | null,
  borrowAmount: number,
  tokenPrice: number
): PoolHealthEstimateMeta | null {
  if (poolGlobalUserData == null || liquidationSummary == null) return null;
  const minLt = liquidationSummary.minAfter;
  const ltBefore = liquidationSummary.minSup ?? liquidationSummary.minAfter;
  if (!Number.isFinite(minLt) || !Number.isFinite(ltBefore)) return null;

  const borrowUsd =
    Math.max(0, Number.isFinite(borrowAmount) ? borrowAmount : 0) *
    (tokenPrice > 0 && Number.isFinite(tokenPrice) ? tokenPrice : 0);
  const C0 = poolGlobalUserData.totalCollateralValue;
  const B0 = poolGlobalUserData.totalBorrowValue;
  const borrowAfter = B0 + borrowUsd;

  const hfAfterRaw = calculateUserHealthFactor(
    C0,
    borrowAfter,
    minLt,
    "borrow-modal-est-hf-after"
  );
  const hfBeforeRaw = calculateUserHealthFactor(
    C0,
    B0,
    ltBefore,
    "borrow-modal-est-hf-before"
  );

  const cap = (h: number | null) => (h == null ? null : Math.min(h, 3.0));
  const value = cap(hfAfterRaw);
  const beforeCapped = cap(hfBeforeRaw);

  let deltaPercent: number | null = null;
  if (
    beforeCapped != null &&
    value != null &&
    beforeCapped > 0 &&
    Number.isFinite(beforeCapped)
  ) {
    const pct = ((value - beforeCapped) / beforeCapped) * 100;
    if (Number.isFinite(pct) && Math.abs(pct) > 1e-6) {
      deltaPercent = pct;
    }
  }

  return { value, deltaPercent, beforeValue: beforeCapped };
}

/**
 * Pool-level HF after repaying debt vs current (same cap 3.0 as Portfolio).
 * Collateral unchanged; borrow (USD) decreases by repayAmount × token price.
 */
export function estimatePoolHealthAfterRepay(
  poolGlobalUserData: {
    totalCollateralValue: number;
    totalBorrowValue: number;
  } | null,
  liquidationSummary: LiquidationThresholdSummaryDeposit | null,
  repayAmount: number,
  tokenPrice: number
): PoolHealthEstimateMeta | null {
  if (poolGlobalUserData == null || liquidationSummary == null) return null;
  const minLt = liquidationSummary.minAfter;
  const ltBefore = liquidationSummary.minSup ?? liquidationSummary.minAfter;
  if (!Number.isFinite(minLt) || !Number.isFinite(ltBefore)) return null;

  const repayUsd =
    Math.max(0, Number.isFinite(repayAmount) ? repayAmount : 0) *
    (tokenPrice > 0 && Number.isFinite(tokenPrice) ? tokenPrice : 0);
  const C0 = poolGlobalUserData.totalCollateralValue;
  const B0 = poolGlobalUserData.totalBorrowValue;
  const borrowAfter = Math.max(0, B0 - repayUsd);

  const hfAfterRaw = calculateUserHealthFactor(
    C0,
    borrowAfter,
    minLt,
    "repay-modal-est-hf-after"
  );
  const hfBeforeRaw = calculateUserHealthFactor(
    C0,
    B0,
    ltBefore,
    "repay-modal-est-hf-before"
  );

  const cap = (h: number | null) => (h == null ? null : Math.min(h, 3.0));
  const value = cap(hfAfterRaw);
  const beforeCapped = cap(hfBeforeRaw);

  let deltaPercent: number | null = null;
  if (
    beforeCapped != null &&
    value != null &&
    beforeCapped > 0 &&
    Number.isFinite(beforeCapped)
  ) {
    const pct = ((value - beforeCapped) / beforeCapped) * 100;
    if (Number.isFinite(pct) && Math.abs(pct) > 1e-6) {
      deltaPercent = pct;
    }
  }

  return { value, deltaPercent, beforeValue: beforeCapped };
}
