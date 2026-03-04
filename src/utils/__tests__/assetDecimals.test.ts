/**
 * Unit tests for asset decimal display and oracle price conversion.
 * See docs/ASSET_DECIMALS_AND_DISPLAY.md.
 */

import { describe, it, expect } from "vitest";
import {
  getDisplayDecimals,
  getTokenPriceFromOracle,
} from "../assetDecimals";

describe("getDisplayDecimals", () => {
  it("returns token decimals when within 0..8", () => {
    expect(getDisplayDecimals(6)).toBe(6);
    expect(getDisplayDecimals(8)).toBe(8);
    expect(getDisplayDecimals(0)).toBe(0);
  });

  it("caps at 8 for high-decimal assets", () => {
    expect(getDisplayDecimals(9)).toBe(8);
    expect(getDisplayDecimals(18)).toBe(8);
  });

  it("uses default when tokenDecimals is undefined", () => {
    expect(getDisplayDecimals(undefined)).toBe(6);
    expect(getDisplayDecimals(undefined, 8)).toBe(8);
  });

  it("clamps negative to 0", () => {
    expect(getDisplayDecimals(-1)).toBe(0);
  });

  it("handles fractional decimals by flooring", () => {
    expect(getDisplayDecimals(6.7)).toBe(6);
  });
});

describe("getTokenPriceFromOracle", () => {
  it("converts 6-decimal token: divisor 10^6", () => {
    // raw 7.12e6 -> 7.12 USD per token
    expect(getTokenPriceFromOracle(7_120_000, 6)).toBe(7.12);
    expect(getTokenPriceFromOracle(97_000_000_000_000, 6)).toBe(97_000_000);
  });

  it("converts 8-decimal token: divisor 10^4", () => {
    // Same raw price: 6 decimals -> divide by 10^6, 8 decimals -> divide by 10^4
    expect(getTokenPriceFromOracle(7120000, 6)).toBe(7.12);
    expect(getTokenPriceFromOracle(7120000, 8)).toBe(712);
  });

  it("returns 0 for zero or invalid raw price", () => {
    expect(getTokenPriceFromOracle(0, 6)).toBe(0);
    expect(getTokenPriceFromOracle(NaN, 6)).toBe(0);
  });
});
