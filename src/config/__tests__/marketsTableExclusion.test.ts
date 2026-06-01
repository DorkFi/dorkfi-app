import { describe, expect, it } from "vitest";
import {
  isMarketsTableExcludedMarket,
  isMarketsTableExcludedPool,
} from "@/config";

const POOL_C = "3578814346";

describe("markets table Pool C exclusion", () => {
  it("excludes entire Pool C at pool level", () => {
    expect(isMarketsTableExcludedPool("algorand-mainnet", POOL_C)).toBe(true);
  });

  it("hides Pool C LP markets from the table", () => {
    expect(
      isMarketsTableExcludedMarket(
        "algorand-mainnet",
        POOL_C,
        "LP_TMPOOL2_UNIT_ALGO"
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
});
