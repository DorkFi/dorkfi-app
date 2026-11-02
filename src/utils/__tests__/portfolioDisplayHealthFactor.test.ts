import { describe, expect, it } from "vitest";
import {
  computePortfolioDisplayHealthFactor,
  depositsForHealthFromChainUserData,
  sumGlobalUserTotals,
} from "@/utils/portfolioDisplayHealthFactor";

describe("portfolioDisplayHealthFactor", () => {
  it("uses worst pool HF across globalUserData rows", () => {
    const scale = (usd: number) => String(BigInt(Math.round(usd * 1e12)));
    const deposits = [
      { poolId: "100", marketId: "1", value: 1 },
      { poolId: "200", marketId: "2", value: 1 },
    ];
    const marketData = [
      {
        poolId: "100",
        marketId: "1",
        liquidationThreshold: 0.85,
      },
      {
        poolId: "200",
        marketId: "2",
        liquidationThreshold: 0.85,
      },
    ];
    const hf = computePortfolioDisplayHealthFactor({
      globalUserData: [
        {
          network: "voi-mainnet",
          poolId: "100",
          totalCollateralValue: scale(10_000),
          totalBorrowValue: scale(5_000),
        },
        {
          network: "voi-mainnet",
          poolId: "200",
          totalCollateralValue: scale(10_000),
          totalBorrowValue: scale(8_000),
        },
      ],
      deposits,
      marketData,
    });
    // Pool 100: 10000*0.85/5000 = 1.7; pool 200: 10000*0.85/8000 ≈ 1.0625
    expect(hf).toBeCloseTo(1.0625, 3);
  });

  it("builds deposit rows from chain user data with scaled deposits", () => {
    const deps = depositsForHealthFromChainUserData([
      {
        network: "voi-mainnet",
        marketId: "420069",
        underlyingContractId: "420069",
        appId: "47139778",
        poolId: "47139778",
        scaledDeposits: "1000",
        scaledBorrows: "0",
        depositIndex: "0",
        borrowIndex: "0",
      },
      {
        network: "voi-mainnet",
        marketId: "2",
        underlyingContractId: "2",
        appId: "47139778",
        poolId: "47139778",
        scaledDeposits: "0",
        scaledBorrows: "0",
        depositIndex: "0",
        borrowIndex: "0",
      },
    ]);
    expect(deps).toHaveLength(1);
    expect(deps[0].marketId).toBe("420069");
  });

  it("sums global user totals across pools", () => {
    const scale = (usd: number) => String(BigInt(Math.round(usd * 1e12)));
    const { totalCollateral, totalBorrowed } = sumGlobalUserTotals([
      {
        network: "voi-mainnet",
        poolId: "1",
        totalCollateralValue: scale(100),
        totalBorrowValue: scale(40),
      },
      {
        network: "voi-mainnet",
        poolId: "2",
        totalCollateralValue: scale(50),
        totalBorrowValue: scale(10),
      },
    ]);
    expect(totalCollateral).toBe(150);
    expect(totalBorrowed).toBe(50);
  });

  it("preserves fractional USD when decoding 1e12-scaled globals", () => {
    const scale = (usd: number) => String(BigInt(Math.round(usd * 1e12)));
    const { totalCollateral, totalBorrowed } = sumGlobalUserTotals([
      {
        network: "algorand-mainnet",
        poolId: "1",
        totalCollateralValue: scale(1.317055),
        totalBorrowValue: scale(0),
      },
    ]);
    expect(totalCollateral).toBeCloseTo(1.317055, 6);
    expect(totalBorrowed).toBe(0);
  });
});
