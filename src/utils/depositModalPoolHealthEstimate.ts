import { calculateUserHealthFactor } from "@/utils/userHealth";
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
};

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

  return { value, deltaPercent };
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

  return { value, deltaPercent };
}
