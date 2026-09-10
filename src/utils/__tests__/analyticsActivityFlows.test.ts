import { describe, expect, it } from "vitest";
import {
  aggregateEventsByDay,
  mergeDailyFlows,
  symmetricYDomain,
} from "@/utils/analyticsActivityFlows";

describe("analyticsActivityFlows", () => {
  it("aggregates events by UTC day", () => {
    const daily = aggregateEventsByDay(
      [
        { timestamp: Date.parse("2024-01-01T12:00:00Z"), id: 1 },
        { timestamp: Date.parse("2024-01-01T18:00:00Z"), id: 2 },
        { timestamp: Date.parse("2024-01-02T08:00:00Z"), id: 3 },
      ],
      (event) => (event.id === 3 ? 50 : 100)
    );

    expect(daily["2024-01-01"]).toBe(200);
    expect(daily["2024-01-02"]).toBe(50);
  });

  it("merges inflow and outflow into signed netflow series", () => {
    const merged = mergeDailyFlows(
      { "2024-01-01": 1000, "2024-01-02": 500 },
      { "2024-01-01": 300, "2024-01-03": 200 }
    );

    expect(merged).toEqual([
      {
        date: "2024-01-01",
        inflow: 1000,
        outflow: -300,
        netflow: 700,
      },
      {
        date: "2024-01-02",
        inflow: 500,
        outflow: 0,
        netflow: 500,
      },
      {
        date: "2024-01-03",
        inflow: 0,
        outflow: -200,
        netflow: -200,
      },
    ]);
  });

  it("builds a symmetric y-axis domain", () => {
    expect(
      symmetricYDomain([
        {
          date: "2024-01-01",
          inflow: 1000,
          outflow: -400,
          netflow: 600,
        },
      ])
    ).toEqual([-1100, 1100]);
  });
});
