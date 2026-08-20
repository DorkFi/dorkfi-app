import { describe, it, expect } from "vitest";
import {
  ANALYTICS_USD_12_DECIMALS,
  ANALYTICS_USD_UNSCALED,
  activityRowToUsd,
  analyticsSummaryToUsd,
  analyticsValueToUsd,
  detectAnalyticsUsdScale,
  pickWithdrawValueUsd,
  unscaledBaseAmountToUsd,
} from "../analyticsActivityUsd";
import { analyticsMarketUsdKey } from "../analyticsProtocolTvl";

describe("analyticsValueToUsd", () => {
  it("converts 12-decimal deposit USD (amount × 1e6)", () => {
    expect(analyticsValueToUsd("1990868000000", "1990868")).toBeCloseTo(
      1.990868,
      6
    );
  });

  it("converts 12-decimal borrow USD", () => {
    expect(analyticsValueToUsd("1000000000000000", "1000000000")).toBeCloseTo(
      1000,
      6
    );
  });

  it("does not treat unscaled token units as dollars", () => {
    expect(analyticsValueToUsd("1990868", "1990000")).toBe(0);
    expect(analyticsValueToUsd("2000002004709", "2000000000000")).toBe(0);
  });

  it("prefers withdrawValueUSD over withdrawalValueUSD", () => {
    expect(
      pickWithdrawValueUsd({
        withdrawValueUSD: "10",
        withdrawalValueUSD: "99",
      })
    ).toBe("10");
  });

  it("returns 0 for missing or invalid values", () => {
    expect(analyticsValueToUsd(undefined, "1")).toBe(0);
    expect(analyticsValueToUsd("not-a-number", "1")).toBe(0);
  });

  it("defaults to 12-decimal when amount is missing", () => {
    expect(detectAnalyticsUsdScale("1990868000000")).toBe(
      ANALYTICS_USD_12_DECIMALS
    );
    expect(analyticsValueToUsd("1990868000000")).toBeCloseTo(1.990868, 6);
  });
});

describe("activityRowToUsd", () => {
  it("prices unscaled FINITE withdrawals with decimals and USD/token", () => {
    const lookup = new Map([
      [
        analyticsMarketUsdKey("algorand-mainnet", "3211805086"),
        { decimals: 8, usdPerToken: 0.0066 },
      ],
    ]);
    expect(
      activityRowToUsd(
        {
          amount: "2000000000000",
          valueUsd: "2000002004709",
          network: "algorand-mainnet",
          marketId: "3211805086",
        },
        lookup
      )
    ).toBeCloseTo(132, 0);
  });

  it("prices unscaled USDC withdrawals at $1", () => {
    const lookup = new Map([
      [
        analyticsMarketUsdKey("algorand-mainnet", "3210682240"),
        { decimals: 6, usdPerToken: 1 },
      ],
    ]);
    expect(
      activityRowToUsd(
        {
          amount: "1990000",
          valueUsd: "1990868",
          network: "algorand-mainnet",
          marketId: "3210682240",
        },
        lookup
      )
    ).toBeCloseTo(1.99, 2);
  });

  it("returns 0 when the market has no price quote", () => {
    expect(
      activityRowToUsd(
        {
          amount: "2000000000000",
          valueUsd: "2000002004709",
          network: "algorand-mainnet",
          marketId: "3211805086",
        },
        new Map()
      )
    ).toBe(0);
  });

  it("marks live withdrawals as unscaled", () => {
    expect(detectAnalyticsUsdScale("2000002004709", "2000000000000")).toBe(
      ANALYTICS_USD_UNSCALED
    );
  });
});

describe("unscaledBaseAmountToUsd", () => {
  it("converts BRO base units with a sub-cent price", () => {
    expect(
      unscaledBaseAmountToUsd("30000000000000", 6, 0.000009)
    ).toBeCloseTo(270, 0);
  });
});

describe("analyticsSummaryToUsd", () => {
  it("does not treat an unscaled withdrawal summary as USD", () => {
    expect(
      analyticsSummaryToUsd("433087796550212", [
        { valueUsd: "1990868", amount: "1990000" },
      ])
    ).toBe(0);
  });

  it("uses 12-decimal scale when sample rows are deposits", () => {
    expect(
      analyticsSummaryToUsd("243352153063810262", [
        { valueUsd: "1990868000000", amount: "1990868" },
      ])
    ).toBeCloseTo(243352.15306381026, 4);
  });
});
