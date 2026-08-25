import { describe, expect, it } from "vitest";
import { overlayOnDemandMarketDisplayUsd } from "@/utils/overlayOnDemandMarketUsd";

describe("overlayOnDemandMarketDisplayUsd", () => {
  it("scales goBTC market TVL from its own DEX USD", () => {
    const row = overlayOnDemandMarketDisplayUsd(
      {
        asset: "goBTC",
        configSymbol: "goBTC",
        poolId: "3333688282",
        totalSupplyUSD: 0.536955 * 60_725 * 1_000_000,
        totalBorrowUSD: 0,
        supplyCapUSD: 1 * 60_725 * 1_000_000,
        marketInfo: {
          decimals: 8,
          marketId: "3211820549",
          oracleUsdPerToken: 60_725,
          price: "1",
          symbol: "goBTC",
        },
      },
      "algorand-mainnet",
      new Map([
        [386192725, 76_124],
        [1058926737, 72_793],
      ])
    );
    expect(row.totalSupplyUSD / 1_000_000).toBeCloseTo(0.536955 * 76_124, 2);
    expect(row.supplyCapUSD / 1_000_000).toBeCloseTo(76_124, 2);
  });

  it("does not overlay VOI market TVL from Tinyman ALGO", () => {
    const row = overlayOnDemandMarketDisplayUsd(
      {
        asset: "VOI",
        configSymbol: "VOI",
        poolId: "41760711",
        totalSupplyUSD: 1000,
        totalBorrowUSD: 0,
        supplyCapUSD: 1000,
        marketInfo: {
          decimals: 6,
          marketId: "41877720",
          oracleUsdPerToken: 0.012,
          price: "1",
          symbol: "VOI",
        },
      },
      "voi-mainnet",
      new Map([[0, 0.0914]])
    );
    expect(row.totalSupplyUSD).toBe(1000);
  });
});
