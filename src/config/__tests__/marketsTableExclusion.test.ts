import { describe, expect, it } from "vitest";
import {
  getMarketsTableVisibleTokensWithDisplayInfo,
  isMarketsTableExcludedMarket,
  isMarketsTableExcludedPool,
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
});
