/**
 * Portfolio headline health factor (worst pool HF, then aggregate fallback).
 * Mirrors {@link Portfolio} `displayHealthFactor` logic for reuse in Markets modal, etc.
 */

import type { ChainGlobalUserRow, ChainUserDataRow } from "@/services/lendingService";
import { marketRowForPortfolioPosition } from "@/utils/marketRowForPortfolioPosition";
import {
  calculateUserHealthFactor,
  normalizeLiquidationThresholdToDecimal,
} from "@/utils/userHealth";

export type PortfolioHealthDeposit = {
  poolId?: string;
  value?: number;
  asset?: string;
  marketId?: string;
};

export type MarketRowForHealth = {
  symbol?: string;
  asset?: string;
  poolId?: string;
  marketId?: string | number;
  liquidationThreshold?: unknown;
  marketInfo?: {
    poolId?: string | number;
    marketId?: string | number;
    liquidationThreshold?: unknown;
  };
};

export function saturateHealthFactorForDisplay(
  healthFactor: number | null
): number | null {
  if (healthFactor === null) return null;
  return Math.min(healthFactor, 3.0);
}

function marketRowForHealth(
  rows: unknown[],
  pos: {
    marketId?: string | null;
    poolId?: string | null;
    displaySymbol?: string | null;
  }
): MarketRowForHealth | undefined {
  const mid = pos.marketId != null ? String(pos.marketId) : "";
  const pid = pos.poolId != null ? String(pos.poolId) : "";
  if (mid !== "" && pid !== "") {
    const hit = rows.find((raw) => {
      const m = raw as MarketRowForHealth;
      const mi = m.marketInfo;
      const rowMid = String(m.marketId ?? mi?.marketId ?? "");
      const rowPid = String(m.poolId ?? mi?.poolId ?? "");
      return rowMid === mid && rowPid === pid;
    });
    if (hit) return hit as MarketRowForHealth;
  }
  const sym = pos.displaySymbol ?? "";
  if (sym !== "" && pid !== "") {
    const hit = rows.find((raw) => {
      const m = raw as MarketRowForHealth;
      return (
        (m.symbol === sym || m.asset === sym) &&
        String(m.poolId ?? m.marketInfo?.poolId ?? "") === pid
      );
    });
    if (hit) return hit as MarketRowForHealth;
  }
  return marketRowForPortfolioPosition(rows, pos) as
    | MarketRowForHealth
    | undefined;
}

function liquidationThresholdFromMarketRow(
  market: MarketRowForHealth | undefined
): unknown {
  if (!market) return undefined;
  return market.liquidationThreshold ?? market.marketInfo?.liquidationThreshold;
}

export function minLiquidationThresholdForDeposits(
  deposits: PortfolioHealthDeposit[],
  marketData: unknown[]
): number {
  if (!deposits.length || !marketData.length) {
    return normalizeLiquidationThresholdToDecimal(undefined);
  }
  const thresholds: number[] = [];
  for (const deposit of deposits) {
    if (!deposit.value || deposit.value <= 0) continue;
    const market = marketRowForHealth(marketData, {
      marketId: deposit.marketId,
      poolId: deposit.poolId,
      displaySymbol: deposit.asset,
    });
    const raw = liquidationThresholdFromMarketRow(market);
    if (raw !== undefined && raw !== null) {
      thresholds.push(normalizeLiquidationThresholdToDecimal(raw));
    }
  }
  return thresholds.length > 0
    ? Math.min(...thresholds)
    : normalizeLiquidationThresholdToDecimal(undefined);
}

/** Min LT among listed market rows in a pool (fast path when deposit scan is too heavy). */
export function minLtForPoolFromMarketRows(
  poolId: string,
  marketData: unknown[]
): number {
  const thresholds: number[] = [];
  const pid = String(poolId);
  for (const raw of marketData) {
    const m = raw as MarketRowForHealth;
    const rowPid = String(m.poolId ?? m.marketInfo?.poolId ?? "");
    if (rowPid !== pid) continue;
    const lt = liquidationThresholdFromMarketRow(m);
    if (lt !== undefined && lt !== null) {
      thresholds.push(normalizeLiquidationThresholdToDecimal(lt));
    }
  }
  return thresholds.length > 0
    ? Math.min(...thresholds)
    : normalizeLiquidationThresholdToDecimal(undefined);
}

export function minLiquidationThresholdFromMarketRows(
  marketData: unknown[]
): number {
  const thresholds: number[] = [];
  for (const raw of marketData) {
    const m = raw as MarketRowForHealth;
    const lt = liquidationThresholdFromMarketRow(m);
    if (lt !== undefined && lt !== null) {
      thresholds.push(normalizeLiquidationThresholdToDecimal(lt));
    }
  }
  return thresholds.length > 0
    ? Math.min(...thresholds)
    : normalizeLiquidationThresholdToDecimal(undefined);
}

function minLtForPool(
  poolId: string,
  deposits: PortfolioHealthDeposit[],
  marketData: unknown[]
): number {
  const thresholds: number[] = [];
  for (const deposit of deposits) {
    if (String(deposit.poolId ?? "") !== poolId) continue;
    if (!deposit.value || deposit.value <= 0) continue;
    const market = marketRowForHealth(marketData, {
      marketId: deposit.marketId,
      poolId: deposit.poolId,
      displaySymbol: deposit.asset,
    });
    const raw = liquidationThresholdFromMarketRow(market);
    if (raw !== undefined && raw !== null) {
      thresholds.push(normalizeLiquidationThresholdToDecimal(raw));
    }
  }
  return thresholds.length > 0
    ? Math.min(...thresholds)
    : normalizeLiquidationThresholdToDecimal(undefined);
}

/**
 * Convert `get_global_user` collateral/borrow values (USD × 1e12) to a JS number.
 * Must not use `Number(raw / 1e12n)` — BigInt division truncates (e.g. $1.32 → $1).
 */
export function parsePoolGlobalUsd(value: unknown): number {
  try {
    const raw = BigInt(String(value ?? 0));
    const scale = 10n ** 12n;
    const whole = raw / scale;
    const frac = raw % scale;
    return Number(whole) + Number(frac) / 1e12;
  } catch {
    return 0;
  }
}

/** Deposits with `value > 0` from chain user rows (for LT lookup). */
export function depositsForHealthFromChainUserData(
  userData: ChainUserDataRow[]
): PortfolioHealthDeposit[] {
  const out: PortfolioHealthDeposit[] = [];
  for (const row of userData) {
    try {
      if (BigInt(row.scaledDeposits) === 0n) continue;
    } catch {
      continue;
    }
    out.push({
      poolId: row.poolId,
      marketId: row.marketId ?? row.underlyingContractId,
      value: 1,
    });
  }
  return out;
}

export function sumGlobalUserTotals(globalUserData: ChainGlobalUserRow[]): {
  totalCollateral: number;
  totalBorrowed: number;
} {
  let totalCollateral = 0;
  let totalBorrowed = 0;
  for (const rec of globalUserData) {
    totalCollateral += parsePoolGlobalUsd(rec.totalCollateralValue);
    totalBorrowed += parsePoolGlobalUsd(rec.totalBorrowValue);
  }
  return { totalCollateral, totalBorrowed };
}

/**
 * Same metric as Portfolio headline HF: minimum HF across pools with borrows,
 * using per-pool `get_global_user` totals and min LT from user deposits in that pool.
 */
export function computePortfolioDisplayHealthFactor(args: {
  globalUserData: ChainGlobalUserRow[] | Array<Record<string, unknown>>;
  deposits: PortfolioHealthDeposit[];
  marketData: unknown[];
  totalCollateral?: number;
  totalBorrowed?: number;
  /**
   * When true, derive pool LT from `marketData` rows (no per-market `get_user` deposit scan).
   * Slightly conservative vs Portfolio but much faster for Markets modal.
   */
  useMarketRowsForPoolLt?: boolean;
}): number | null {
  const { globalUserData, deposits, marketData, useMarketRowsForPoolLt } = args;

  const minLiquidationThresholdForHealth = useMarketRowsForPoolLt
    ? minLiquidationThresholdFromMarketRows(marketData)
    : minLiquidationThresholdForDeposits(deposits, marketData);

  const summed =
    args.totalCollateral !== undefined && args.totalBorrowed !== undefined
      ? {
          totalCollateral: args.totalCollateral,
          totalBorrowed: args.totalBorrowed,
        }
      : sumGlobalUserTotals(globalUserData as ChainGlobalUserRow[]);

  let worst: number | null = null;

  if (Array.isArray(globalUserData) && globalUserData.length > 0) {
    for (const item of globalUserData) {
      const rec = item as Record<string, unknown>;
      const poolId = String(rec.appId ?? rec.poolId ?? "");
      if (!poolId) continue;

      const collateral = parsePoolGlobalUsd(rec.totalCollateralValue);
      const borrow = parsePoolGlobalUsd(rec.totalBorrowValue);
      if (borrow <= 0) continue;

      const lt = useMarketRowsForPoolLt
        ? minLtForPoolFromMarketRows(poolId, marketData)
        : minLtForPool(poolId, deposits, marketData);
      const hf = calculateUserHealthFactor(
        collateral,
        borrow,
        lt,
        `pool:${poolId}`
      );
      if (hf != null && Number.isFinite(hf)) {
        if (worst === null || hf < worst) {
          worst = hf;
        }
      }
    }
  }

  const aggregateFallback = calculateUserHealthFactor(
    summed.totalCollateral,
    summed.totalBorrowed,
    minLiquidationThresholdForHealth,
    "portfolio-aggregate-fallback"
  );

  const healthFactorValue = worst !== null ? worst : aggregateFallback;
  return saturateHealthFactorForDisplay(healthFactorValue);
}
