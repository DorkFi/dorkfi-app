import { describe, expect, it } from "vitest";
import {
  itemMatchesPortfolioPositionFilters,
  positionMatchesMarketFilter,
  positionMatchesNetworkFilter,
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

describe("positionMatchesNetworkFilter", () => {
  it("returns true for all networks", () => {
    expect(positionMatchesNetworkFilter("algorand-mainnet", "all")).toBe(true);
    expect(positionMatchesNetworkFilter(undefined, "all")).toBe(true);
  });

  it("matches algorand and voi by network id substring", () => {
    expect(
      positionMatchesNetworkFilter("algorand-mainnet", "algorand")
    ).toBe(true);
    expect(positionMatchesNetworkFilter("voi-mainnet", "voi")).toBe(true);
    expect(positionMatchesNetworkFilter("algorand-mainnet", "voi")).toBe(
      false
    );
  });

  it("passes through when network is missing", () => {
    expect(positionMatchesNetworkFilter(undefined, "algorand")).toBe(true);
  });
});

describe("itemMatchesPortfolioPositionFilters", () => {
  const baseItem = {
    asset: "USDC",
    poolId: "3333688282",
    network: "algorand-mainnet",
  };

  it("matches when all filters are open", () => {
    expect(
      itemMatchesPortfolioPositionFilters(baseItem, {
        networkFilter: "all",
        marketFilter: "all",
      })
    ).toBe(true);
  });

  it("filters by search term (trimmed, case-insensitive)", () => {
    expect(
      itemMatchesPortfolioPositionFilters(baseItem, {
        searchTerm: "usdc",
        networkFilter: "all",
      })
    ).toBe(true);
    expect(
      itemMatchesPortfolioPositionFilters(baseItem, {
        searchTerm: "  algo  ",
        networkFilter: "all",
      })
    ).toBe(false);
    expect(
      itemMatchesPortfolioPositionFilters(baseItem, {
        searchTerm: "   ",
        networkFilter: "all",
      })
    ).toBe(true);
  });

  it("filters by network and market tier together", () => {
    expect(
      itemMatchesPortfolioPositionFilters(baseItem, {
        networkFilter: "algorand",
        marketFilter: "A",
      })
    ).toBe(true);
    expect(
      itemMatchesPortfolioPositionFilters(baseItem, {
        networkFilter: "voi",
        marketFilter: "A",
      })
    ).toBe(false);
    expect(
      itemMatchesPortfolioPositionFilters(baseItem, {
        networkFilter: "algorand",
        marketFilter: "B",
      })
    ).toBe(false);
  });

  it("passes network filter when row network is missing", () => {
    expect(
      itemMatchesPortfolioPositionFilters(
        { asset: "USDC", poolId: "3333688282" },
        {
          networkFilter: "voi",
          marketFilter: "all",
        }
      )
    ).toBe(true);
  });

  it("uses marketNetworkFallback for tier matching", () => {
    expect(
      itemMatchesPortfolioPositionFilters(
        { asset: "USDC", poolId: "3333688282" },
        {
          networkFilter: "all",
          marketFilter: "A",
          marketNetworkFallback: "algorand-mainnet",
        }
      )
    ).toBe(true);
  });
});
