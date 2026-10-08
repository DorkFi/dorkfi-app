import { describe, expect, it } from "vitest";
import { usdPerLpTokenFromSnapshot } from "@/services/tinymanLiquidityService";

describe("usdPerLpTokenFromSnapshot", () => {
  it("divides Tinyman TVL by issued LP supply", () => {
    expect(
      usdPerLpTokenFromSnapshot({
        apr: {
          feeAprPercent: null,
          feeApyPercent: null,
          totalAprPercent: null,
          totalApyPercent: null,
          liquidityUsd: 100,
          volume24hUsd: null,
        },
        totalLiquidity: 50_000_000n,
      })
    ).toBe(2);
  });

  it("returns null when TVL or supply is missing", () => {
    expect(usdPerLpTokenFromSnapshot(null)).toBeNull();
    expect(
      usdPerLpTokenFromSnapshot({
        apr: {
          feeAprPercent: null,
          feeApyPercent: null,
          totalAprPercent: null,
          totalApyPercent: null,
          liquidityUsd: 0,
          volume24hUsd: null,
        },
        totalLiquidity: 50_000_000n,
      })
    ).toBeNull();
  });
});
