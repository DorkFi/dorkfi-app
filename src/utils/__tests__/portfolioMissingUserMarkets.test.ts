import { describe, expect, it } from "vitest";
import { getPortfolioVisibleTokens } from "@/config";
import {
  configuredMarketsMissingFromUserData,
  poolHasGlobalPosition,
  unionPortfolioPositionRows,
} from "../portfolioMissingUserMarkets";

describe("poolHasGlobalPosition", () => {
  it("is true when collateral or borrow is non-zero", () => {
    expect(
      poolHasGlobalPosition({ totalCollateralValue: "1", totalBorrowValue: "0" })
    ).toBe(true);
    expect(
      poolHasGlobalPosition({
        totalCollateralValue: "0",
        totalBorrowValue: "4035455192621",
      })
    ).toBe(true);
  });

  it("is false when both are zero", () => {
    expect(
      poolHasGlobalPosition({ totalCollateralValue: "0", totalBorrowValue: "0" })
    ).toBe(false);
  });
});

describe("configuredMarketsMissingFromUserData", () => {
  it("lists pool B ALGO when the indexer omitted that userData row (#646)", () => {
    const pools = [
      {
        network: "algorand-mainnet",
        appId: 3333688282,
        totalCollateralValue: "10005186000000",
        totalBorrowValue: "6896316000000",
      },
      {
        network: "algorand-mainnet",
        appId: 3345940978,
        totalCollateralValue: "6898214000000",
        totalBorrowValue: "4035455192621",
      },
    ];
    const userData = [
      { appId: 3333688282, marketId: 3210682240 },
      { appId: 3333688282, marketId: 3333688448 },
      { appId: 3345940978, marketId: 3333688448 },
      { appId: 3333688282, marketId: 3207744109 },
    ];
    const configured = getPortfolioVisibleTokens("algorand-mainnet").map(
      (t) => ({
        network: "algorand-mainnet",
        poolId: t.poolId,
        marketId: t.underlyingContractId,
        originalContractId: t.originalContractId,
      })
    );

    const missing = configuredMarketsMissingFromUserData({
      pools,
      userData,
      configured,
    });

    expect(missing).toEqual(
      expect.arrayContaining([
        {
          network: "algorand-mainnet",
          poolId: "3345940978",
          marketId: "3207744109",
        },
      ])
    );
    expect(missing).not.toEqual(
      expect.arrayContaining([
        {
          network: "algorand-mainnet",
          poolId: "3333688282",
          marketId: "3207744109",
        },
      ])
    );
  });
});

describe("unionPortfolioPositionRows", () => {
  it("keeps API rows and adds on-chain-only borrows", () => {
    const api = [
      {
        type: "borrow" as const,
        network: "algorand-mainnet",
        poolId: "3333688282",
        marketId: "3333688448",
        asset: "WAD",
      },
    ];
    const chain = [
      {
        type: "borrow" as const,
        network: "algorand-mainnet",
        poolId: "3333688282",
        marketId: "3333688448",
        asset: "WAD-chain",
      },
      {
        type: "borrow" as const,
        network: "algorand-mainnet",
        poolId: "3345940978",
        marketId: "3207744109",
        asset: "ALGO",
      },
    ];
    const merged = unionPortfolioPositionRows(api, chain);
    expect(merged).toHaveLength(2);
    expect(merged[0].asset).toBe("WAD");
    expect(merged[1].asset).toBe("ALGO");
    expect(merged[1].poolId).toBe("3345940978");
  });
});
