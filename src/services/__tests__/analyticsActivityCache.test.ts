import { beforeEach, describe, expect, it, vi } from "vitest";

const getDeposits = vi.fn();
const getWithdrawals = vi.fn();
const getBorrows = vi.fn();
const getRepays = vi.fn();
const fetchOracleMarketUsdLookupForRefs = vi.fn();

vi.mock("@/services/dorkfiAPIService", () => ({
  dorkfiAPIService: {
    getDeposits: (...args: unknown[]) => getDeposits(...args),
    getWithdrawals: (...args: unknown[]) => getWithdrawals(...args),
    getBorrows: (...args: unknown[]) => getBorrows(...args),
    getRepays: (...args: unknown[]) => getRepays(...args),
  },
}));

vi.mock("@/services/analyticsProtocolTvl", () => ({
  fetchOracleMarketUsdLookupForRefs: (...args: unknown[]) =>
    fetchOracleMarketUsdLookupForRefs(...args),
}));

describe("analyticsActivityCache", () => {
  beforeEach(async () => {
    vi.resetModules();
    getDeposits.mockReset();
    getWithdrawals.mockReset();
    getBorrows.mockReset();
    getRepays.mockReset();
    fetchOracleMarketUsdLookupForRefs.mockReset();
    fetchOracleMarketUsdLookupForRefs.mockResolvedValue(new Map());

    const { __resetAnalyticsActivityCacheForTests } = await import(
      "@/services/analyticsActivityCache"
    );
    __resetAnalyticsActivityCacheForTests();
  });

  it("dedupes concurrent deposit fetches and reuses cache", async () => {
    getDeposits.mockResolvedValue({
      success: true,
      data: {
        deposits: [
          {
            timestamp: Date.parse("2024-04-01T12:00:00Z"),
            round: 1,
            amount: "1000000",
            depositValueUSD: "1000000000000",
          },
          {
            timestamp: Date.parse("2024-04-01T18:00:00Z"),
            round: 2,
            amount: "1000000",
            depositValueUSD: "2000000000000",
          },
        ],
      },
    });

    const {
      fetchActivityDailySeries,
      fetchActivitySeriesForPeriod,
    } = await import("@/services/analyticsActivityCache");

    const [a, b] = await Promise.all([
      fetchActivityDailySeries("deposits"),
      fetchActivityDailySeries("deposits"),
    ]);

    expect(getDeposits).toHaveBeenCalledTimes(1);
    expect(a).toEqual([{ date: "2024-04-01", amount: 3 }]);
    expect(b).toEqual(a);

    const now = Date.parse("2024-04-05T12:00:00Z");
    const sliced = await fetchActivitySeriesForPeriod("deposits", "7d", now);
    expect(getDeposits).toHaveBeenCalledTimes(1);
    expect(sliced).toEqual(a);
  });

  it("builds liquidity flows from shared deposit/withdrawal caches", async () => {
    getDeposits.mockResolvedValue({
      success: true,
      data: {
        deposits: [
          {
            timestamp: Date.parse("2024-04-01T12:00:00Z"),
            round: 1,
            amount: "1000000",
            depositValueUSD: "5000000000000",
          },
        ],
      },
    });
    getWithdrawals.mockResolvedValue({
      success: true,
      data: {
        withdrawals: [
          {
            timestamp: Date.parse("2024-04-01T15:00:00Z"),
            round: 2,
            amount: "1000000",
            withdrawValueUSD: "2000000000000",
          },
        ],
      },
    });

    const {
      fetchLiquidityFlowSeries,
      fetchActivityDailySeries,
    } = await import("@/services/analyticsActivityCache");

    const flows = await fetchLiquidityFlowSeries("90d");
    expect(flows).toEqual([
      {
        date: "2024-04-01",
        inflow: 5,
        outflow: -2,
        netflow: 3,
      },
    ]);

    await fetchActivityDailySeries("deposits");
    await fetchActivityDailySeries("withdrawals");
    expect(getDeposits).toHaveBeenCalledTimes(1);
    expect(getWithdrawals).toHaveBeenCalledTimes(1);
  });
});
