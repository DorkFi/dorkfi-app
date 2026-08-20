import { describe, expect, it } from "vitest";
import {
  availableBorrowLiquidityTokens,
  effectiveAvailableBorrowTokens,
  floorTokenAmount,
  safeMaxBorrowTokens,
  theoreticalMaxBorrowTokens,
} from "@/utils/easyBorrowMath";

describe("easyBorrowMath", () => {
  it("floors token amounts to decimals", () => {
    expect(floorTokenAmount(1.23456789, 4)).toBe(1.2345);
    expect(floorTokenAmount(0, 6)).toBe(0);
  });

  it("computes theoretical max from CF", () => {
    // $150 collateral, 70% CF, $0 existing debt, $1 borrow token
    const max = theoreticalMaxBorrowTokens({
      existingCollateralUsd: 0,
      existingBorrowUsd: 0,
      additionalCollateralUsd: 150,
      collateralFactor: 0.7,
      borrowTokenPrice: 1,
    });
    expect(max).toBeCloseTo(105, 6);
  });

  it("computes safe max below liquidation using HF target 1.1", () => {
    // C=$150, LT=80%, min HF=1.1 → max borrow USD = 150*0.8/1.1 ≈ 109.09
    // But wait - safeMaxBorrowTokens uses LT percent and min HF.
    const max = safeMaxBorrowTokens({
      poolGlobal: { totalCollateralValue: 0, totalBorrowValue: 0 },
      additionalCollateralUsd: 150,
      liquidationThresholdPercent: 80,
      borrowTokenPrice: 1,
      borrowDecimals: 6,
      minHealthFactor: 1.1,
    });
    expect(max).toBeCloseTo(109.090909, 2);
  });

  it("respects liquidity and borrow cap", () => {
    expect(
      availableBorrowLiquidityTokens({
        totalDeposits: 1000,
        totalBorrows: 400,
        borrowCap: 700,
      })
    ).toBe(300); // min(600 liquidity, 300 remaining cap)

    expect(
      availableBorrowLiquidityTokens({
        totalDeposits: 1000,
        totalBorrows: 400,
      })
    ).toBe(600);
  });

  it("skips cash-pool liquidity for mint / sToken markets", () => {
    expect(
      availableBorrowLiquidityTokens({
        totalDeposits: 0,
        totalBorrows: 500,
        skipCashLiquidity: true,
      })
    ).toBeNull();

    expect(
      availableBorrowLiquidityTokens({
        totalDeposits: 0,
        totalBorrows: 500,
        borrowCap: 800,
        skipCashLiquidity: true,
      })
    ).toBe(300);

    expect(
      availableBorrowLiquidityTokens({
        totalDeposits: 0,
        totalBorrows: 800,
        borrowCap: 800,
        skipCashLiquidity: true,
      })
    ).toBe(0);
  });

  it("takes the most restrictive available borrow", () => {
    expect(
      effectiveAvailableBorrowTokens({
        safeMax: 84,
        chainMax: 100,
        liquidity: 50,
      })
    ).toBe(50);
  });

  it("ignores null liquidity (mint route with no borrow cap)", () => {
    expect(
      effectiveAvailableBorrowTokens({
        safeMax: 84,
        chainMax: 100,
        liquidity: null,
      })
    ).toBe(84);
  });

  it("handles missing oracle / zero price for theoretical max", () => {
    expect(
      theoreticalMaxBorrowTokens({
        existingCollateralUsd: 100,
        existingBorrowUsd: 0,
        additionalCollateralUsd: 0,
        collateralFactor: 0.7,
        borrowTokenPrice: 0,
      })
    ).toBeNull();
  });
});
