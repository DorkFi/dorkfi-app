import { describe, expect, it } from "vitest";
import { calculateDepositAPY } from "@/utils/apyCalculations";

/**
 * Live Pool G USDC book (POST /market-data/.../3697602173/3210682240).
 * Earn must show this compounded supply APY, not the stale GET snapshot (~0.04%).
 */
describe("Pool G USDC supply APY", () => {
  it("compounds to 4.88% on the live utilization book", () => {
    const result = calculateDepositAPY(
      { borrowRate: 300, slope: 1000, reserveFactor: 1500 },
      {
        totalScaledDeposits: "479949144",
        totalScaledBorrows: "294564533",
        lastUpdateTime: 0,
      }
    );
    expect(result.apy.toFixed(2)).toBe("4.88");
  });

  it("is near zero on the stale GET snapshot Earn used to read", () => {
    const result = calculateDepositAPY(
      { borrowRate: 300, slope: 1000, reserveFactor: 1500 },
      {
        totalScaledDeposits: "64021779",
        totalScaledBorrows: "1000257",
        lastUpdateTime: 0,
      }
    );
    expect(Number(result.apy.toFixed(2))).toBeLessThan(0.1);
  });
});
