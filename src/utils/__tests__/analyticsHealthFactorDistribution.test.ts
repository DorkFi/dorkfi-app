import { describe, expect, it } from "vitest";
import { buildHealthFactorDistribution } from "../analyticsHealthFactorDistribution";

describe("buildHealthFactorDistribution", () => {
  it("buckets unique borrowers by worst health factor and ignores no-borrow rows", () => {
    const distribution = buildHealthFactorDistribution([
      {
        userAddress: "ALGO_SAFE",
        healthFactor: 2.4,
        totalBorrowValue: "1000",
      },
      {
        userAddress: "ALGO_SAFE",
        healthFactor: 1.05,
        totalBorrowValue: "2000",
      },
      {
        userAddress: "VOI_LIQ",
        healthFactor: 0.9,
        totalBorrowValue: "500",
      },
      {
        userAddress: "NO_BORROW",
        healthFactor: 10,
        totalBorrowValue: "0",
      },
      {
        userAddress: "NULL_HF",
        healthFactor: null,
        totalBorrowValue: "100",
      },
    ]);

    expect(distribution).toEqual([
      { range: "<1.0", count: 1 },
      { range: "1.0-1.1", count: 1 },
      { range: "1.1-1.2", count: 0 },
      { range: "1.2-1.5", count: 0 },
      { range: ">1.5", count: 0 },
    ]);
  });

  it("places 1.5 in the 1.2-1.5 bucket", () => {
    const distribution = buildHealthFactorDistribution([
      {
        userAddress: "EDGE",
        healthFactor: 1.5,
        totalBorrowValue: "1",
      },
    ]);
    expect(distribution.find((row) => row.range === "1.2-1.5")?.count).toBe(1);
    expect(distribution.find((row) => row.range === ">1.5")?.count).toBe(0);
  });
});
