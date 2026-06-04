import { describe, expect, it } from "vitest";
import {
  getPortfolioVisibleTokens,
  isMarketsTableExcludedMarket,
  isMarketsTableExcludedPool,
  isPortfolioExcludedMarketContract,
} from "@/config";

const POOL_C = "3578814346";
const POOL_E = "3585829377";

describe("markets table Pool C exclusion", () => {
  it("excludes Pool C and Pool E at pool level", () => {
    expect(isMarketsTableExcludedPool("algorand-mainnet", POOL_C)).toBe(true);
    expect(isMarketsTableExcludedPool("algorand-mainnet", POOL_E)).toBe(true);
  });

  it("hides Pool C and Pool E LP markets from the table", () => {
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
  });

  it("keeps WAD on Pool C visible (exception)", () => {
    expect(
      isMarketsTableExcludedMarket("algorand-mainnet", POOL_C, "WAD")
    ).toBe(false);
  });

  it("does not exclude WAD on Pool A", () => {
    expect(
      isMarketsTableExcludedMarket("algorand-mainnet", "3333688282", "WAD")
    ).toBe(false);
  });

  it("excludes Pool C LP from portfolio visible tokens", () => {
    const visible = getPortfolioVisibleTokens("algorand-mainnet");
    expect(
      visible.some(
        (t) =>
          String(t.poolId) === POOL_C &&
          t.configKey === "LP_TMPOOL2_UNIT_ALGO"
      )
    ).toBe(false);
    expect(
      visible.some(
        (t) => String(t.poolId) === POOL_C && t.configKey === "WAD"
      )
    ).toBe(true);
  });

  it("resolves portfolio exclusion by market contract id", () => {
    expect(
      isPortfolioExcludedMarketContract(
        "algorand-mainnet",
        POOL_C,
        "3577729953"
      )
    ).toBe(true);
    expect(
      isPortfolioExcludedMarketContract(
        "algorand-mainnet",
        POOL_C,
        "3333688448"
      )
    ).toBe(false);
  });
});
