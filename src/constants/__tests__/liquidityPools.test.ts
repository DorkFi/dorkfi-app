import { describe, expect, it } from "vitest";
import {
  CURATED_LIQUIDITY_POOLS,
  pairHasPoolsPageLendingPosition,
  pairHasWadLpLendingMarket,
  resolvePoolsPageLendingMarket,
} from "@/constants/liquidityPools";

const NETWORK = "algorand-mainnet" as const;
const POOL_C = "3578814346";
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

  it("resolves WAD/UNIT via WAD LP market (not UNIT collateral)", () => {
    const pair = pairById("wad-unit");
    expect(pairHasPoolsPageLendingPosition(NETWORK, pair)).toBe(false);
    expect(pairHasWadLpLendingMarket(NETWORK, pair)).toBe(true);
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

  it("returns null for WAD pairs without configured LP_TMPOOL2_WAD_* markets", () => {
    for (const id of ["wad-usdc", "wad-gobtc", "wad-goeth", "wad-algo"]) {
      const pair = pairById(id);
      expect(pairHasWadLpLendingMarket(NETWORK, pair)).toBe(false);
      expect(resolvePoolsPageLendingMarket(NETWORK, pair)).toBeNull();
    }
  });
});

describe("findCuratedLiquidityPairByLpTokenId", () => {
  it("maps LP ASA id to curated pair", async () => {
    const { findCuratedLiquidityPairByLpTokenId } = await import(
      "@/constants/liquidityPools"
    );
    expect(findCuratedLiquidityPairByLpTokenId(NETWORK, 3334546641)?.id).toBe(
      "wad-unit"
    );
    expect(findCuratedLiquidityPairByLpTokenId(NETWORK, 3334448440)?.id).toBe(
      "wad-usdc"
    );
  });
});
