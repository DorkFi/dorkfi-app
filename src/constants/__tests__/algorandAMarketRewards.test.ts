import { describe, expect, it } from "vitest";
import {
  ALGORAND_A_MARKET_POOL_ID,
  ALGORAND_A_REWARDS_MIN_EXCESS_ALGO,
  effectiveHasRewards,
  isAlgorandAMarketRewardsSubject,
  marketExcess,
} from "@/constants/algorandAMarketRewards";

describe("marketExcess", () => {
  it("returns supply minus borrow when positive", () => {
    expect(marketExcess(50_000, 10_000)).toBe(40_000);
  });

  it("floors at zero when borrow exceeds supply", () => {
    expect(marketExcess(10_000, 50_000)).toBe(0);
  });

  it("returns 0 for non-finite inputs", () => {
    expect(marketExcess(Number.NaN, 1)).toBe(0);
    expect(marketExcess(1, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("isAlgorandAMarketRewardsSubject", () => {
  it("matches algorand-mainnet A pool only", () => {
    expect(
      isAlgorandAMarketRewardsSubject("algorand-mainnet", ALGORAND_A_MARKET_POOL_ID)
    ).toBe(true);
    expect(
      isAlgorandAMarketRewardsSubject("algorand-mainnet", "3345940978")
    ).toBe(false);
    expect(
      isAlgorandAMarketRewardsSubject("voi-mainnet", ALGORAND_A_MARKET_POOL_ID)
    ).toBe(false);
  });
});

describe("effectiveHasRewards", () => {
  it("returns false when config hasRewards is not true", () => {
    expect(
      effectiveHasRewards({
        hasRewards: false,
        networkId: "algorand-mainnet",
        poolId: ALGORAND_A_MARKET_POOL_ID,
        totalSupply: 100_000,
        totalBorrow: 0,
      })
    ).toBe(false);
  });

  it("leaves non-A-market rewards unchanged", () => {
    expect(
      effectiveHasRewards({
        hasRewards: true,
        networkId: "algorand-mainnet",
        poolId: "47139781",
        totalSupply: 0,
        totalBorrow: 0,
      })
    ).toBe(true);
    expect(
      effectiveHasRewards({
        hasRewards: true,
        networkId: "voi-mainnet",
        poolId: "1",
        totalSupply: 0,
        totalBorrow: 0,
      })
    ).toBe(true);
  });

  it("hides Algorand A rewards when excess is below 30k", () => {
    expect(
      effectiveHasRewards({
        hasRewards: true,
        networkId: "algorand-mainnet",
        poolId: ALGORAND_A_MARKET_POOL_ID,
        totalSupply: ALGORAND_A_REWARDS_MIN_EXCESS_ALGO - 1,
        totalBorrow: 0,
      })
    ).toBe(false);
    expect(
      effectiveHasRewards({
        hasRewards: true,
        networkId: "algorand-mainnet",
        poolId: ALGORAND_A_MARKET_POOL_ID,
        totalSupply: 40_000,
        totalBorrow: 15_000,
      })
    ).toBe(false);
  });

  it("shows Algorand A rewards at or above 30k excess", () => {
    expect(
      effectiveHasRewards({
        hasRewards: true,
        networkId: "algorand-mainnet",
        poolId: ALGORAND_A_MARKET_POOL_ID,
        totalSupply: ALGORAND_A_REWARDS_MIN_EXCESS_ALGO,
        totalBorrow: 0,
      })
    ).toBe(true);
    expect(
      effectiveHasRewards({
        hasRewards: true,
        networkId: "algorand-mainnet",
        poolId: ALGORAND_A_MARKET_POOL_ID,
        totalSupply: 100_000,
        totalBorrow: 50_000,
      })
    ).toBe(true);
  });

  it("treats missing totals as zero excess (hide until loaded)", () => {
    expect(
      effectiveHasRewards({
        hasRewards: true,
        networkId: "algorand-mainnet",
        poolId: ALGORAND_A_MARKET_POOL_ID,
      })
    ).toBe(false);
  });
});
