import { describe, expect, it } from "vitest";
import {
  mergeGlobalUserRowsPreferChain,
  resolvePortfolioHeadlineTotals,
} from "@/utils/portfolioChainOverlay";

describe("mergeGlobalUserRowsPreferChain", () => {
  it("keeps API pools and overlays live chain rows", () => {
    const merged = mergeGlobalUserRowsPreferChain(
      [
        {
          network: "algorand-mainnet",
          poolId: "3333688282",
          totalCollateralValue: "150000000000000",
          totalBorrowValue: "0",
        },
      ],
      [
        {
          network: "algorand-mainnet",
          poolId: "3333688282",
          totalCollateralValue: "150000000000000",
          totalBorrowValue: "0",
        },
        {
          network: "algorand-mainnet",
          poolId: "3589083110",
          totalCollateralValue: "40000000000000",
          totalBorrowValue: "0",
        },
      ]
    );

    expect(merged).toHaveLength(2);
    const poolF = merged.find((row) => row.poolId === "3589083110");
    expect(poolF?.totalCollateralValue).toBe("40000000000000");
  });

  it("replaces a stale API pool with the chain snapshot", () => {
    const merged = mergeGlobalUserRowsPreferChain(
      [
        {
          network: "algorand-mainnet",
          poolId: "3589083110",
          totalCollateralValue: "0",
          totalBorrowValue: "0",
        },
      ],
      [
        {
          network: "algorand-mainnet",
          poolId: "3589083110",
          totalCollateralValue: "40000000000000",
          totalBorrowValue: "0",
        },
      ]
    );

    expect(merged[0]?.totalCollateralValue).toBe("40000000000000");
  });
});

describe("resolvePortfolioHeadlineTotals", () => {
  const poolA = "3333688282";
  const lpPool = "3589083110";
  const network = "algorand-mainnet";

  it("prefers fresher on-chain collateral over a stale-high API total", () => {
    const { totalCollateral, totalBorrowed } = resolvePortfolioHeadlineTotals({
      apiPools: [
        {
          network,
          poolId: poolA,
          totalCollateralValue: "200000000000000",
          totalBorrowValue: "10000000000000",
        },
      ],
      chainPools: [
        {
          network,
          poolId: poolA,
          totalCollateralValue: "150000000000000",
          totalBorrowValue: "8000000000000",
        },
      ],
      rowCollateralUsdByPool: { [`${network}|${poolA}`]: 200 },
      rowBorrowUsdByPool: { [`${network}|${poolA}`]: 10 },
      rpcBorrowUsd: 12,
    });

    expect(totalCollateral).toBe(150);
    expect(totalBorrowed).toBe(12);
  });

  it("adds row collateral only for pools chain/API did not return", () => {
    const { totalCollateral } = resolvePortfolioHeadlineTotals({
      apiPools: [
        {
          network,
          poolId: poolA,
          totalCollateralValue: "100000000000000",
          totalBorrowValue: "0",
        },
      ],
      chainPools: [],
      rowCollateralUsdByPool: {
        [`${network}|${poolA}`]: 999,
        [`${network}|${lpPool}`]: 40,
      },
    });

    expect(totalCollateral).toBe(140);
  });
});
