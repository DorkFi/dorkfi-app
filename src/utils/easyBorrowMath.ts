/**
 * Local Easy Borrow quote math.
 * Composes existing health helpers — does not invent protocol formulas.
 */
import { MAX_WITHDRAW_HEALTH_FACTOR_TARGET } from "@/services/lendingService";
import {
  buildLiquidationThresholdSummaryForDeposit,
  maxBorrowTokenAmountForMinEstimatedHealth,
  type LiquidationThresholdSummaryDeposit,
  type PoolHealthEstimateMeta,
} from "@/utils/depositModalPoolHealthEstimate";
import { calculateUserHealthFactor } from "@/utils/userHealth";
import { getHealthFactorBand, type HealthFactorBand } from "@/utils/healthFactorUx";

export { MAX_WITHDRAW_HEALTH_FACTOR_TARGET };

export type PoolGlobalSnapshot = {
  totalCollateralValue: number;
  totalBorrowValue: number;
};

/** Floor a human token amount to `decimals` (max 8 for UI). */
export function floorTokenAmount(amount: number, decimals: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const d = Math.min(Math.max(0, decimals), 8);
  const f = 10 ** d;
  return Math.floor(amount * f + Number.EPSILON) / f;
}

/**
 * Theoretical max borrow from CF on (existing collateral USD + new supply USD).
 * Used for display; safe max / chain max remain authoritative for CTA limits.
 */
export function theoreticalMaxBorrowTokens(args: {
  existingCollateralUsd: number;
  existingBorrowUsd: number;
  additionalCollateralUsd: number;
  collateralFactor: number;
  borrowTokenPrice: number;
}): number | null {
  const {
    existingCollateralUsd,
    existingBorrowUsd,
    additionalCollateralUsd,
    collateralFactor,
    borrowTokenPrice,
  } = args;
  if (
    !Number.isFinite(collateralFactor) ||
    collateralFactor <= 0 ||
    !Number.isFinite(borrowTokenPrice) ||
    borrowTokenPrice <= 0
  ) {
    return null;
  }
  const borrowPowerUsd =
    (Math.max(0, existingCollateralUsd) + Math.max(0, additionalCollateralUsd)) *
    collateralFactor;
  const availableUsd = borrowPowerUsd - Math.max(0, existingBorrowUsd);
  if (!Number.isFinite(availableUsd)) return null;
  return Math.max(0, availableUsd / borrowTokenPrice);
}

/** Safe max borrow tokens keeping estimated HF ≥ {@link MAX_WITHDRAW_HEALTH_FACTOR_TARGET}. */
export function safeMaxBorrowTokens(args: {
  poolGlobal: PoolGlobalSnapshot | null;
  additionalCollateralUsd: number;
  liquidationThresholdPercent: number;
  borrowTokenPrice: number;
  borrowDecimals: number;
  minHealthFactor?: number;
}): number | null {
  const minHf = args.minHealthFactor ?? MAX_WITHDRAW_HEALTH_FACTOR_TARGET;
  const base: PoolGlobalSnapshot = args.poolGlobal ?? {
    totalCollateralValue: 0,
    totalBorrowValue: 0,
  };
  const simulated: PoolGlobalSnapshot = {
    totalCollateralValue:
      Math.max(0, base.totalCollateralValue) +
      Math.max(0, args.additionalCollateralUsd),
    totalBorrowValue: Math.max(0, base.totalBorrowValue),
  };
  const summary = buildLiquidationThresholdSummaryForDeposit(
    args.liquidationThresholdPercent,
    undefined,
    undefined
  );
  const raw = maxBorrowTokenAmountForMinEstimatedHealth(
    simulated,
    summary,
    args.borrowTokenPrice,
    minHf
  );
  if (raw == null || !Number.isFinite(raw)) return null;
  return floorTokenAmount(raw, args.borrowDecimals);
}

/**
 * Available liquidity for the borrow market (deposits − borrows), human tokens.
 * Returns `null` when cash liquidity is skipped and no borrow cap applies
 * (WAD mint / sToken — same as MintModal treating supply as unlimited).
 */
export function availableBorrowLiquidityTokens(args: {
  totalDeposits: number;
  totalBorrows: number;
  borrowCap?: number | null;
  /** Skip deposits−borrows; mint markets have no idle cash to draw. */
  skipCashLiquidity?: boolean;
}): number | null {
  const deposits = Number.isFinite(args.totalDeposits) ? args.totalDeposits : 0;
  const borrows = Number.isFinite(args.totalBorrows) ? args.totalBorrows : 0;
  const remainingCap =
    args.borrowCap != null && args.borrowCap > 0
      ? Math.max(0, args.borrowCap - borrows)
      : null;

  if (args.skipCashLiquidity) {
    return remainingCap;
  }

  const liquidity = Math.max(0, deposits - borrows);
  if (remainingCap != null) {
    return Math.min(liquidity, remainingCap);
  }
  return liquidity;
}

/** Clamp user borrow to the most restrictive of safe / chain / liquidity caps. */
export function effectiveAvailableBorrowTokens(args: {
  safeMax: number | null;
  chainMax: number | null;
  liquidity: number | null;
}): number {
  const parts = [args.safeMax, args.chainMax, args.liquidity].filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (parts.length === 0) return 0;
  return Math.max(0, Math.min(...parts));
}

/**
 * Pool HF before/after a combined supply + borrow, using the same formula as
 * {@link estimatePoolHealthAfterBorrow} / deposit helpers.
 */
export function estimatePoolHealthAfterSupplyAndBorrow(
  poolGlobal: PoolGlobalSnapshot | null,
  liquidationSummary: LiquidationThresholdSummaryDeposit | null,
  additionalCollateralUsd: number,
  additionalBorrowUsd: number
): PoolHealthEstimateMeta | null {
  if (liquidationSummary == null) return null;
  const minLt = liquidationSummary.minAfter;
  const ltBefore = liquidationSummary.minSup ?? liquidationSummary.minAfter;
  if (!Number.isFinite(minLt) || !Number.isFinite(ltBefore)) return null;

  const base = poolGlobal ?? { totalCollateralValue: 0, totalBorrowValue: 0 };
  const C0 = Math.max(0, base.totalCollateralValue);
  const B0 = Math.max(0, base.totalBorrowValue);
  const C1 = C0 + Math.max(0, additionalCollateralUsd);
  const B1 = B0 + Math.max(0, additionalBorrowUsd);

  const hfAfterRaw = calculateUserHealthFactor(
    C1,
    B1,
    minLt,
    "easy-borrow-est-hf-after"
  );
  const hfBeforeRaw =
    B0 > 0 || C0 > 0
      ? calculateUserHealthFactor(
          C0,
          B0,
          ltBefore,
          "easy-borrow-est-hf-before"
        )
      : null;

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
    if (Number.isFinite(pct) && Math.abs(pct) > 1e-6) deltaPercent = pct;
  }

  return { value, deltaPercent, beforeValue: beforeCapped };
}

/** Liquidation price of collateral given debt / (collateralAmount × LT). */
export function estimateLiquidationPrice(args: {
  collateralAmount: number;
  borrowUsd: number;
  existingBorrowUsd: number;
  existingCollateralUsd: number;
  liquidationThresholdDecimal: number;
}): number | null {
  const {
    collateralAmount,
    borrowUsd,
    existingBorrowUsd,
    existingCollateralUsd,
    liquidationThresholdDecimal,
  } = args;
  if (
    !Number.isFinite(collateralAmount) ||
    collateralAmount <= 0 ||
    !Number.isFinite(liquidationThresholdDecimal) ||
    liquidationThresholdDecimal <= 0
  ) {
    return null;
  }
  const totalBorrow = Math.max(0, existingBorrowUsd) + Math.max(0, borrowUsd);
  if (totalBorrow <= 0) return null;
  // Approx for single-asset new position; multi-asset positions need pool-level LT.
  const otherCollateralUsd = Math.max(0, existingCollateralUsd);
  const numerator = totalBorrow / liquidationThresholdDecimal - otherCollateralUsd;
  if (!Number.isFinite(numerator) || numerator <= 0) return null;
  return numerator / collateralAmount;
}

export function healthBandLabel(band: HealthFactorBand): string {
  switch (band) {
    case "safe":
      return "Healthy";
    case "warning":
      return "Moderate";
    case "at_risk":
      return "High Risk";
    case "blocked":
      return "Too Risky";
    default:
      return "—";
  }
}

export function previewHealthBand(
  healthFactor: number | null
): HealthFactorBand {
  return getHealthFactorBand(healthFactor);
}
