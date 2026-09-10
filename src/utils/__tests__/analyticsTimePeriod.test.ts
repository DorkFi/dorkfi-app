import { describe, expect, it } from "vitest";
import {
  periodToDays,
  sliceDailySeriesByPeriod,
  sumDailyAmounts,
} from "@/utils/analyticsTimePeriod";

describe("analyticsTimePeriod", () => {
  it("maps period tokens to day counts", () => {
    expect(periodToDays("7d")).toBe(7);
    expect(periodToDays("30d")).toBe(30);
    expect(periodToDays("90d")).toBe(90);
  });

  it("returns the full series for 90d", () => {
    const series = [
      { date: "2024-01-01", amount: 1 },
      { date: "2024-03-01", amount: 2 },
    ];
    expect(sliceDailySeriesByPeriod(series, "90d")).toEqual(series);
  });

  it("slices to the selected lookback window", () => {
    const now = Date.parse("2024-04-10T12:00:00Z");
    const series = [
      { date: "2024-01-01", amount: 1 },
      { date: "2024-03-20", amount: 2 },
      { date: "2024-04-05", amount: 3 },
      { date: "2024-04-09", amount: 4 },
    ];

    expect(sliceDailySeriesByPeriod(series, "7d", now)).toEqual([
      { date: "2024-04-05", amount: 3 },
      { date: "2024-04-09", amount: 4 },
    ]);
    expect(sliceDailySeriesByPeriod(series, "30d", now)).toEqual([
      { date: "2024-03-20", amount: 2 },
      { date: "2024-04-05", amount: 3 },
      { date: "2024-04-09", amount: 4 },
    ]);
  });

  it("sums daily amounts", () => {
    expect(
      sumDailyAmounts([
        { amount: 10 },
        { amount: 2.5 },
        { amount: 0 },
      ])
    ).toBe(12.5);
  });
});
