import { describe, expect, it } from "vitest";
import {
  ALPHA_ASA_ID,
  COOP_ASA_ID,
  CURATED_LIQUIDITY_POOLS,
  FINITE_ASA_ID,
  MYTH_ALPHA_ALGO_APP_ADDR,
  MYTH_ALPHA_ALGO_LST_ID,
  MYTH_COOP_ALGO_APP_ADDR,
  MYTH_COOP_ALGO_LST_ID,
  MYTH_FINITE_ALGO_APP_ADDR,
  MYTH_FINITE_ALGO_LST_ID,
  countPoolsByBaseTokenFilter,
  getDexAddButtonLabel,
  getDexAddLiquidityUrl,
  getMythAddLiquidityUrl,
  pairHasLendingContract,
  pairHasPoolsPageLendingPosition,
  pairHasUsdcLpCollateralLendingMarket,
  pairHasUsdcLpLendingMarket,
  pairHasWadLpCollateralLendingMarket,
  pairHasWadLpLendingMarket,
  poolMatchesBaseTokenFilter,
  resolvePoolsPageLendingMarket,
  resolveUsdcLendingPoolIdsForFilter,
  resolveWadLendingPoolIdsForFilter,
} from "@/constants/liquidityPools";

const NETWORK = "algorand-mainnet" as const;
const POOL_C = "3578814346";
const POOL_E = "3585829377";
const POOL_F = "3589083110";
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

  it("resolves Pool F USDC LP pairs (ALGO, tALGO, HAY, ALPHA)", () => {
    const expectations: Record<
      string,
      { configSymbol: string; marketId: string; assetId: string }
    > = {
      "usdc-algo": {
        configSymbol: "LP_TMPOOL2_USDC_ALGO",
        marketId: "3589026317",
        assetId: "1002590888",
      },
      "talgo-usdc": {
        configSymbol: "LP_TMPOOL2_TALGO_USDC",
        marketId: "3589029580",
        assetId: "2537254960",
      },
      "hay-usdc": {
        configSymbol: "LP_TMPOOL2_HAY_USDC",
        marketId: "3589032117",
        assetId: "3196310546",
      },
      "alpha-usdc": {
        configSymbol: "LP_TMPOOL2_ALPHA_USDC",
        marketId: "3589036846",
        assetId: "2741116468",
      },
    };

    for (const [id, expected] of Object.entries(expectations)) {
      const pair = pairById(id);
      expect(pairHasUsdcLpLendingMarket(NETWORK, pair)).toBe(true);
      expect(pairHasUsdcLpCollateralLendingMarket(NETWORK, pair)).toBe(true);
      expect(resolvePoolsPageLendingMarket(NETWORK, pair)).toMatchObject({
        poolId: POOL_F,
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

describe("resolveUsdcLendingPoolIdsForFilter", () => {
  it("returns Pool F when USDC LP collateral pairs are in the filter", () => {
    const usdcPairs = CURATED_LIQUIDITY_POOLS.filter((p) =>
      ["usdc-algo", "talgo-usdc", "hay-usdc", "alpha-usdc"].includes(p.id)
    );
    expect(resolveUsdcLendingPoolIdsForFilter(NETWORK, usdcPairs)).toEqual([
      POOL_F,
    ]);
  });
});

describe("Myth dualSTAKE pairs", () => {
  it.each([
    {
      id: "myth-coop-algo",
      label: "COOP / ALGO",
      assetId: COOP_ASA_ID,
      lstId: MYTH_COOP_ALGO_LST_ID,
      appAddr: MYTH_COOP_ALGO_APP_ADDR,
    },
    {
      id: "myth-alpha-algo",
      label: "ALPHA / ALGO",
      assetId: ALPHA_ASA_ID,
      lstId: MYTH_ALPHA_ALGO_LST_ID,
      appAddr: MYTH_ALPHA_ALGO_APP_ADDR,
    },
    {
      id: "myth-finite-algo",
      label: "FINITE / ALGO",
      assetId: FINITE_ASA_ID,
      lstId: MYTH_FINITE_ALGO_LST_ID,
      appAddr: MYTH_FINITE_ALGO_APP_ADDR,
    },
  ] as const)("curates $label with an Add on Myth Finance link", (expected) => {
    const pair = pairById(expected.id);
    expect(pair.platform).toBe("myth");
    expect(pair.label).toBe(expected.label);
    expect(pair.asset1Id).toBe(expected.assetId);
    expect(pair.asset2Id).toBe(0);
    expect(pair.lpTokenId).toBe(expected.lstId);
    expect(pair.poolAddr).toBe(expected.appAddr);
    expect(pairHasLendingContract(pair)).toBe(false);
    expect(resolvePoolsPageLendingMarket(NETWORK, pair)).toBeNull();
    expect(getDexAddButtonLabel(pair.platform)).toBe("Add on Myth Finance");
    expect(getDexAddLiquidityUrl(pair)).toBe(
      getMythAddLiquidityUrl(expected.lstId)
    );
  });

  it("shows Myth cards on All plus their ASA filters, not UNIT/WAD/USDC", () => {
    const counts = countPoolsByBaseTokenFilter(CURATED_LIQUIDITY_POOLS);
    expect(counts.coop).toBe(1);
    expect(counts.finite).toBe(1);
    expect(counts.alpha).toBeGreaterThanOrEqual(2);
    expect(poolMatchesBaseTokenFilter(pairById("myth-coop-algo"), COOP_ASA_ID)).toBe(
      true
    );
    expect(
      poolMatchesBaseTokenFilter(pairById("myth-alpha-algo"), ALPHA_ASA_ID)
    ).toBe(true);
    expect(
      poolMatchesBaseTokenFilter(pairById("alpha-usdc"), ALPHA_ASA_ID)
    ).toBe(true);
    for (const id of [
      "myth-coop-algo",
      "myth-alpha-algo",
      "myth-finite-algo",
    ] as const) {
      const pair = pairById(id);
      expect(poolMatchesBaseTokenFilter(pair, 3121954282)).toBe(false);
      expect(poolMatchesBaseTokenFilter(pair, 3334160924)).toBe(false);
      expect(poolMatchesBaseTokenFilter(pair, 31566704)).toBe(false);
    }
  });

  it("keeps Tinyman add URLs on existing pairs", () => {
    const pair = pairById("unit-algo");
    expect(getDexAddLiquidityUrl(pair)).toContain("tinyman.org/pool/");
    expect(getDexAddButtonLabel(pair.platform)).toBe("Add on Tinyman");
  });
});
