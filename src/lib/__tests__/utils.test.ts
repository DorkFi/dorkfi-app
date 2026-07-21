import { describe, it, expect } from "vitest";
import { formatUsdPerTokenDisplay } from "../utils";

describe("formatUsdPerTokenDisplay", () => {
  it("uses 2 decimals for prices ≥ $1", () => {
    expect(formatUsdPerTokenDisplay(1)).toBe("1.00");
    expect(formatUsdPerTokenDisplay(66_610.128)).toBe("66,610.13");
  });

  it("keeps 3–4 decimals for $0.01–$1 (e.g. UNIT)", () => {
    expect(formatUsdPerTokenDisplay(0.616)).toBe("0.616");
    expect(formatUsdPerTokenDisplay(0.6164)).toBe("0.6164");
    expect(formatUsdPerTokenDisplay(0.62)).toBe("0.620");
  });

  it("uses extra precision below $0.01", () => {
    expect(formatUsdPerTokenDisplay(0.00123)).toBe("0.00123");
  });

  it("handles zero and non-finite", () => {
    expect(formatUsdPerTokenDisplay(0)).toBe("0.00");
    expect(formatUsdPerTokenDisplay(NaN)).toBe("0.00");
  });
});
