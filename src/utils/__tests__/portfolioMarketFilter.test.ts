import { describe, expect, it } from "vitest";
import {
  positionMatchesMarketFilter,
} from "@/utils/portfolioMarketFilter";

describe("positionMatchesMarketFilter", () => {
  it("returns true for all markets regardless of pool", () => {
    expect(
      positionMatchesMarketFilter("algorand-mainnet", "123", "all")
    ).toBe(true);
    expect(positionMatchesMarketFilter(undefined, undefined, "all")).toBe(
      true
    );
  });

  it("matches A/B/D by network pool label", () => {
    expect(
      positionMatchesMarketFilter(
        "algorand-mainnet",
        "3333688282",
        "A"
      )
    ).toBe(true);
    expect(
      positionMatchesMarketFilter(
        "algorand-mainnet",
        "3333688282",
        "B"
      )
    ).toBe(false);
    expect(
      positionMatchesMarketFilter(
        "algorand-mainnet",
        "3526240577",
        "D"
      )
    ).toBe(true);
  });

  it("returns false when network or pool is missing for tier filter", () => {
    expect(positionMatchesMarketFilter(undefined, "123", "A")).toBe(false);
    expect(positionMatchesMarketFilter("algorand-mainnet", undefined, "A")).toBe(
      false
    );
  });
});
