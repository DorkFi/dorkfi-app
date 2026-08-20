import { describe, it, expect } from "vitest";
import {
  pickFirstFiniteNumber,
  tvlFromGrowthDataPoint,
  usdValueForHumanAmount,
  sumProtocolUsdTotals,
  overlayLiveTvlOnSeries,
  growthPercentFromSeries,
  analyticsMarketUsdKey,
} from "../analyticsProtocolTvl";

describe("pickFirstFiniteNumber", () => {
  it("keeps 0 instead of falling through to a later value", () => {
    expect(pickFirstFiniteNumber(0, 1.2)).toBe(0);
  });

  it("skips null, undefined, and NaN", () => {
    expect(pickFirstFiniteNumber(undefined, null, NaN, 3.5)).toBe(3.5);
  });
});

describe("tvlFromGrowthDataPoint", () => {
  it("prefers tvl over value", () => {
    expect(tvlFromGrowthDataPoint({ tvl: 261_000, value: 1 })).toBe(261_000);
  });

  it("falls back to value when tvl is missing", () => {
    expect(tvlFromGrowthDataPoint({ value: 253_000 })).toBe(253_000);
  });
});

describe("usdValueForHumanAmount", () => {
  it("multiplies deposits by USD per token", () => {
    expect(usdValueForHumanAmount("0.82", 69_456)).toBeCloseTo(56_953.92, 2);
  });

  it("returns 0 for invalid inputs", () => {
    expect(usdValueForHumanAmount("0", 1)).toBe(0);
    expect(usdValueForHumanAmount("1", 0)).toBe(0);
  });
});

describe("sumProtocolUsdTotals", () => {
  it("sums deposit and borrow USD across markets", () => {
    const totals = sumProtocolUsdTotals([
      { totalDeposits: "10", totalBorrows: "2", usdPerToken: 1 },
      { totalDeposits: "0.5", totalBorrows: "0.1", usdPerToken: 70_000 },
    ]);
    expect(totals.tvl).toBeCloseTo(10 + 35_000, 6);
    expect(totals.borrowed).toBeCloseTo(2 + 7_000, 6);
    expect(totals.marketCount).toBe(2);
  });
});

describe("overlayLiveTvlOnSeries", () => {
  it("replaces only the last point", () => {
    const series = [
      { date: "2026-08-01", total: 250_000 },
      { date: "2026-08-19", total: 253_000 },
    ];
    const overlayed = overlayLiveTvlOnSeries(series, 262_000);
    expect(overlayed[0].total).toBe(250_000);
    expect(overlayed[1].total).toBe(262_000);
  });
});

describe("growthPercentFromSeries", () => {
  it("computes 7d change against the point at or before lookback", () => {
    const points = [
      { date: "2026-08-12", total: 250_000 },
      { date: "2026-08-19", total: 253_000 },
    ];
    const growth = growthPercentFromSeries(points, 262_000, 7);
    expect(growth).toBeCloseTo(((262_000 - 250_000) / 250_000) * 100, 6);
  });
});

describe("analyticsMarketUsdKey", () => {
  it("joins network and marketId", () => {
    expect(analyticsMarketUsdKey("algorand-mainnet", "3211805086")).toBe(
      "algorand-mainnet|3211805086"
    );
  });
});
