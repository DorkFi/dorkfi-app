import { describe, expect, it } from "vitest";
import {
  CURATED_LIQUIDITY_POOLS,
  pairHasPoolsPageLendingPosition,
  pairHasWadLpCollateralLendingMarket,
  pairHasWadLpLendingMarket,
  resolvePoolsPageLendingMarket,
  resolveWadLendingPoolIdsForFilter,
} from "@/constants/liquidityPools";

const NETWORK = "algorand-mainnet" as const;
const POOL_C = "3578814346";
const POOL_E = "3585829377";
const LP_WAD_UNIT = "3577783311";

function pairById(id: string) {
  const pair = CURATED_LIQUIDITY_POOLS.find((p) => p.id === id);
  if (!pair) throw new Error(`Missing curated pair: ${id}`);
  return pair;
}

describe("resolvePoolsPageLendingMarket", () => {
  it("resolves UNIT LP collateral pairs (UNIT/ALGO, UNIT/goBTC)", () => {
    for (const id of ["unit-algo", "unit-gobtc"]) {
      const pair = pairById(id);
      expect(pairHasPoolsPageLendingPosition(NETWORK, pair)).toBe(true);
      expect(resolvePoolsPageLendingMarket(NETWORK, pair)).toMatchObject({
        poolId: POOL_C,
        configSymbol: expect.stringMatching(/^LP_TMPOOL2_UNIT_/),
      });
    }
  });

  it("resolves WAD/UNIT via WAD LP market on Pool C (not UNIT collateral)", () => {
    const pair = pairById("wad-unit");
    expect(pairHasPoolsPageLendingPosition(NETWORK, pair)).toBe(false);
    expect(pairHasWadLpLendingMarket(NETWORK, pair)).toBe(true);
    expect(pairHasWadLpCollateralLendingMarket(NETWORK, pair)).toBe(false);
    expect(resolvePoolsPageLendingMarket(NETWORK, pair)).toEqual({
      configSymbol: "LP_TMPOOL2_WAD_UNIT",
      poolId: POOL_C,
      marketId: LP_WAD_UNIT,
      displaySymbol: "TMPOOL2",
      displayName: "TinymanPool2.0 WAD-UNIT",
      logoPath: "/lovable-uploads/LP_TMPOOL2_WAD_UNIT.png",
      decimals: 6,
      assetId: "3334546641",
    });
  });

  it("resolves Pool E WAD LP pairs (ALGO, USDC, goBTC, goETH)", () => {
    const expectations: Record<
      string,
      { configSymbol: string; marketId: string; assetId: string }
    > = {
      "wad-algo": {
        configSymbol: "LP_TMPOOL2_WAD_ALGO",
        marketId: "3578405588",
        assetId: "3346320836",
      },
      "wad-usdc": {
        configSymbol: "LP_TMPOOL2_WAD_USDC",
        marketId: "3577799583",
        assetId: "3334448440",
      },
      "wad-gobtc": {
        configSymbol: "LP_TMPOOL2_WAD_GOBTC",
        marketId: "3578387558",
        assetId: "3355755995",
      },
      "wad-goeth": {
        configSymbol: "LP_TMPOOL2_WAD_GOETH",
        marketId: "3578394082",
        assetId: "3495913115",
      },
    };

    for (const [id, expected] of Object.entries(expectations)) {
      const pair = pairById(id);
      expect(pairHasWadLpLendingMarket(NETWORK, pair)).toBe(true);
      expect(pairHasWadLpCollateralLendingMarket(NETWORK, pair)).toBe(true);
      expect(resolvePoolsPageLendingMarket(NETWORK, pair)).toMatchObject({
        poolId: POOL_E,
        ...expected,
      });
    }
  });
});

describe("resolveWadLendingPoolIdsForFilter", () => {
  it("returns Pool E when WAD LP collateral pairs are in the filter", () => {
    const wadPairs = CURATED_LIQUIDITY_POOLS.filter((p) =>
      ["wad-algo", "wad-usdc", "wad-gobtc", "wad-goeth", "wad-unit"].includes(
        p.id
      )
    );
    expect(resolveWadLendingPoolIdsForFilter(NETWORK, wadPairs)).toEqual([
      POOL_E,
    ]);
  });
});
