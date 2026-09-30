import { describe, expect, it } from "vitest";
import {
  earnRedeemKeepsLoanSafe,
  maxEarnRedeemKeepingLoanSafe,
} from "@/lib/easyStart/repayFromBucket";

describe("maxEarnRedeemKeepingLoanSafe", () => {
  it("allows the full Earn balance when there is no loan", () => {
    expect(
      maxEarnRedeemKeepingLoanSafe({ collateralUsd: 100, borrowUsd: 0 })
    ).toBe(100);
  });

  it("keeps collateral above borrow / liquidation threshold", () => {
    // LT 0.85 → min collateral for a $85 loan is $100. $200 collateral can redeem $100.
    expect(
      maxEarnRedeemKeepingLoanSafe({
        collateralUsd: 200,
        borrowUsd: 85,
        liquidationThreshold: 0.85,
      })
    ).toBeCloseTo(100, 6);
  });

  it("blocks a redeem that would cross the safety line", () => {
    const input = {
      collateralUsd: 120,
      borrowUsd: 85,
      liquidationThreshold: 0.85,
    };
    expect(earnRedeemKeepsLoanSafe({ ...input, redeemUsd: 10 })).toBe(true);
    expect(earnRedeemKeepsLoanSafe({ ...input, redeemUsd: 30 })).toBe(false);
  });
});
