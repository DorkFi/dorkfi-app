import { describe, it, expect } from "vitest";
import {
  portfolioUsdCacheKey,
  rememberPortfolioUsdPerToken,
  resolveWithLastGoodPortfolioUsd,
} from "../portfolioUsdCache";
import { runWithConcurrency } from "../runWithConcurrency";

describe("portfolioUsdCache", () => {
  it("remembers and recalls last-good USD", () => {
    const key = portfolioUsdCacheKey("algorand-mainnet", "1", "2");
    rememberPortfolioUsdPerToken(key, 12.5);
    expect(resolveWithLastGoodPortfolioUsd(0, key)).toBe(12.5);
    expect(resolveWithLastGoodPortfolioUsd(13, key)).toBe(13);
  });

  it("does not invent a price without cache", () => {
    const key = portfolioUsdCacheKey("algorand-mainnet", "9", "9");
    expect(resolveWithLastGoodPortfolioUsd(0, key)).toBe(0);
  });
});

describe("runWithConcurrency", () => {
  it("runs all items with capped parallelism", async () => {
    const seen: number[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      seen.push(n);
      inFlight--;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
