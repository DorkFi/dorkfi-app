import { describe, expect, it } from "vitest";
import {
  getMarketsTableVisibleTokensWithDisplayInfo,
  getPortfolioMarketLabel,
  getPortfolioVisibleTokens,
  getWadBorrowMarketConfigForPool,
  isLpPortfolioPool,
  isLpTmpoolConfigKey,
  isMarketsTableExcludedMarket,
  isMarketsTableExcludedPool,
  isPortfolioExcludedMarketContract,
} from "@/config";

const POOL_C = "3578814346";
const POOL_E = "3585829377";
const POOL_F = "3589083110";

describe("markets table Pool C exclusion", () => {
  it("excludes Pool C, Pool E, and Pool F at pool level", () => {
    expect(isMarketsTableExcludedPool("algorand-mainnet", POOL_C)).toBe(true);
    expect(isMarketsTableExcludedPool("algorand-mainnet", POOL_E)).toBe(true);
    expect(isMarketsTableExcludedPool("algorand-mainnet", POOL_F)).toBe(true);
  });

  it("hides Pool C, Pool E, and Pool F LP markets from the table", () => {
    expect(
      isMarketsTableExcludedMarket(
        "algorand-mainnet",
        POOL_C,
        "LP_TMPOOL2_UNIT_ALGO"
      )
    ).toBe(true);
    expect(
      isMarketsTableExcludedMarket(
        "algorand-mainnet",
        POOL_E,
        "LP_TMPOOL2_WAD_ALGO"
      )
    ).toBe(true);
    expect(
      isMarketsTableExcludedMarket(
        "algorand-mainnet",
        POOL_F,
        "LP_TMPOOL2_USDC_ALGO"
      )
    ).toBe(true);
  });

  it("keeps WAD on Pool C, Pool E, and Pool F visible (exception)", () => {
    expect(
      isMarketsTableExcludedMarket("algorand-mainnet", POOL_C, "WAD")
    ).toBe(false);
    expect(
      isMarketsTableExcludedMarket("algorand-mainnet", POOL_E, "WAD")
    ).toBe(false);
    expect(
      isMarketsTableExcludedMarket("algorand-mainnet", POOL_F, "WAD")
    ).toBe(false);
  });

  it("does not exclude WAD on Pool A", () => {
    expect(
      isMarketsTableExcludedMarket("algorand-mainnet", "3333688282", "WAD")
    ).toBe(false);
  });

  it("omits Pool F TMPOOL2 rows from visible token list", () => {
    const visible = getMarketsTableVisibleTokensWithDisplayInfo(
      "algorand-mainnet"
    );
    expect(
      visible.some(
        (token) =>
          token.configKey === "LP_TMPOOL2_USDC_ALGO" &&
          String(token.poolId) === POOL_F
      )
    ).toBe(false);
    expect(
      visible.some(
        (token) =>
          token.configKey === "WAD" && String(token.poolId) === POOL_F
      )
    ).toBe(true);
  });

  it("never surfaces TMPOOL2 / LP_TMPOOL2_* on the Markets table token list (dorkfi-app#651)", () => {
    const visible = getMarketsTableVisibleTokensWithDisplayInfo(
      "algorand-mainnet"
    );
    expect(visible.some((token) => token.symbol === "TMPOOL2")).toBe(false);
    expect(
      visible.some((token) =>
        String(token.configKey ?? "").startsWith("LP_TMPOOL2_")
      )
    ).toBe(false);
  });
});

describe("portfolio LP visibility", () => {
  it("includes TMPOOL2 LP deposits in portfolio token lists", () => {
    const visible = getPortfolioVisibleTokens("algorand-mainnet");
    expect(
      visible.some(
        (token) =>
          token.configKey === "LP_TMPOOL2_UNIT_ALGO" &&
          String(token.poolId) === POOL_C
      )
    ).toBe(true);
    expect(
      visible.some(
        (token) =>
          token.configKey === "LP_TMPOOL2_WAD_ALGO" &&
          String(token.poolId) === POOL_E
      )
    ).toBe(true);
    expect(
      visible.some(
        (token) =>
          token.configKey === "LP_TMPOOL2_USDC_ALGO" &&
          String(token.poolId) === POOL_F
      )
    ).toBe(true);
  });

  it("does not exclude LP market contracts from portfolio", () => {
    expect(
      isPortfolioExcludedMarketContract(
        "algorand-mainnet",
        POOL_C,
        "3577729953"
      )
    ).toBe(false);
    expect(
      isPortfolioExcludedMarketContract(
        "algorand-mainnet",
        POOL_E,
        "3578405588"
      )
    ).toBe(false);
    expect(
      isPortfolioExcludedMarketContract(
        "algorand-mainnet",
        POOL_F,
        "3589026317"
      )
    ).toBe(false);
  });

  it("uses pair display labels instead of generic TMPOOL2", () => {
    const unitAlgo = getPortfolioVisibleTokens("algorand-mainnet").find(
      (token) => token.configKey === "LP_TMPOOL2_UNIT_ALGO"
    );
    expect(unitAlgo?.symbol).toBe("UNIT/ALGO LP");
    expect(unitAlgo?.name).toBe("UNIT / ALGO LP");
  });

  it("labels Pool C/E/F as LP on Positions", () => {
    expect(isLpPortfolioPool("algorand-mainnet", POOL_C)).toBe(true);
    expect(getPortfolioMarketLabel("algorand-mainnet", POOL_C)).toBe("LP");
    expect(getPortfolioMarketLabel("algorand-mainnet", POOL_E)).toBe("LP");
    expect(getPortfolioMarketLabel("algorand-mainnet", POOL_F)).toBe("LP");
    expect(getPortfolioMarketLabel("algorand-mainnet", "3333688282")).toBe("A");
    expect(getPortfolioMarketLabel("algorand-mainnet", "3526240577")).toBe("D");
  });

  it("resolves WAD borrow/mint markets for LP collateral pools", () => {
    expect(isLpTmpoolConfigKey("LP_TMPOOL2_UNIT_ALGO")).toBe(true);
    expect(getWadBorrowMarketConfigForPool("algorand-mainnet", POOL_C)?.poolId).toBe(
      POOL_C
    );
    expect(getWadBorrowMarketConfigForPool("algorand-mainnet", POOL_E)?.poolId).toBe(
      POOL_E
    );
    expect(getWadBorrowMarketConfigForPool("algorand-mainnet", POOL_F)?.poolId).toBe(
      POOL_F
    );
  });
});
