import { describe, expect, it } from "vitest";
import { mergeGlobalUserRowsPreferChain } from "@/utils/portfolioChainOverlay";

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
