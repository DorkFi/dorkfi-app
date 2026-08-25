import { describe, it, expect } from "vitest";
import { depositFromNTokenShares } from "../lendingService";

const SCALE = "1000000000000000000"; // 1e18
const NTOKEN_RAW = "6620550"; // 6.620550 nUSDC (mpappalardo123 Pool A)

describe("depositFromNTokenShares", () => {
  it("converts nToken shares at a 1e18 deposit index to 6dp underlying", () => {
    expect(depositFromNTokenShares(NTOKEN_RAW, SCALE, 6)).toEqual({
      balance: 6.62055,
      interest: 0,
    });
  });

  it("treats a 0 deposit index as raw 6dp units", () => {
    expect(depositFromNTokenShares(NTOKEN_RAW, "0", 6)).toEqual({
      balance: 6.62055,
      interest: 0,
    });
  });

  it("applies a >1e18 deposit index to redeemable underlying", () => {
    // 6620550 * 1.064e18 / 1e18 = 7044265 raw → 7.044265 USDC
    expect(
      depositFromNTokenShares(NTOKEN_RAW, "1064000000000000000", 6).balance
    ).toBeCloseTo(7.044265, 6);
  });

  it("returns zeros for empty shares", () => {
    expect(depositFromNTokenShares("0", SCALE, 6)).toEqual({
      balance: 0,
      interest: 0,
    });
    expect(depositFromNTokenShares("", SCALE, 6)).toEqual({
      balance: 0,
      interest: 0,
    });
  });
});
