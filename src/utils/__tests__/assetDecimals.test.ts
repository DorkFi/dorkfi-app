/**
 * Unit tests for asset decimal display and oracle price conversion.
 * See docs/ASSET_DECIMALS_AND_DISPLAY.md.
 */

import { describe, it, expect } from "vitest";
import {
  getDisplayDecimals,
  getTokenPriceFromOracle,
  usdPerTokenFromMarketInfoFormattedPrice,
  usdPerTokenFromMarketInfoPrice,
  usdValueForHumanTokenAmount,
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

/**
 * Regression: est. health factor in supply/deposit modals used the wrong divisor for 8-decimal
 * assets (e.g. UNIT). USD/token must match Portfolio `formatPriceFromContract(MarketInfo.price, d)`:
 * formatted price ÷ 10^(12−d), not `getTokenPriceFromOracle(priceRaw, d)` on the full integer.
 */
describe("usdPerTokenFromMarketInfoFormattedPrice", () => {
  it("uses divisor 10^6 for 6-decimal tokens (e.g. USDC)", () => {
    expect(usdPerTokenFromMarketInfoFormattedPrice("7120000", 6)).toBe(7.12);
    expect(usdPerTokenFromMarketInfoFormattedPrice(7120000, 6)).toBe(7.12);
  });

  it("uses divisor 10^4 for 8-decimal tokens (e.g. UNIT) — not 10^6", () => {
    expect(usdPerTokenFromMarketInfoFormattedPrice("7120000", 8)).toBe(712);
    // Same formatted field as 6-dec case above: 8-dec USD is 100× larger (10^6 / 10^4)
    expect(usdPerTokenFromMarketInfoFormattedPrice("7120000", 8)).toBe(
      100 * usdPerTokenFromMarketInfoFormattedPrice("7120000", 6)
    );
  });

  it("matches Portfolio-style math: same string, different decimals => ratio 10^(d2−d1)", () => {
    const p = "0.000123456789";
    const usd6 = usdPerTokenFromMarketInfoFormattedPrice(p, 6);
    const usd8 = usdPerTokenFromMarketInfoFormattedPrice(p, 8);
    expect(usd8 / usd6).toBe(100);
  });

  it("returns 0 for empty, zero, or non-finite formatted price", () => {
    expect(usdPerTokenFromMarketInfoFormattedPrice("0", 6)).toBe(0);
    expect(usdPerTokenFromMarketInfoFormattedPrice("", 6)).toBe(0);
    expect(usdPerTokenFromMarketInfoFormattedPrice(NaN, 6)).toBe(0);
  });

  it("does not treat WAD-scale priceRaw like 12-dec oracle (regression guard)", () => {
    const wadOneUsd = 1e18;
    const wrongIfOracleFnOnRaw = getTokenPriceFromOracle(wadOneUsd, 8);
    expect(wrongIfOracleFnOnRaw).toBeGreaterThan(1e10);

    const formattedLikeFetchMarketInfo = "1";
    const correct = usdPerTokenFromMarketInfoFormattedPrice(formattedLikeFetchMarketInfo, 8);
    expect(correct).toBe(1 / 10_000);
  });
});

describe("usdPerTokenFromMarketInfoPrice", () => {
  it("applies 12-dec oracle divisor for typical fetchMarketInfo strings (< 1e9)", () => {
    expect(usdPerTokenFromMarketInfoPrice("7120000", 6)).toBe(7.12);
    expect(usdPerTokenFromMarketInfoPrice(250_000, 6)).toBe(0.25);
  });

  it("divides raw wad (>= 1e12) by 1e18 then applies oracle divisor", () => {
    // 7.12e6 * 1e18 — same post-wad as formatted "7120000" from fetchMarketInfo
    const raw = "7120000000000000000000000";
    expect(usdPerTokenFromMarketInfoPrice(raw, 6)).toBeCloseTo(7.12, 5);
  });

  it("matches formatted-only helper for post-wad values", () => {
    const s = "7120000";
    expect(usdPerTokenFromMarketInfoPrice(s, 6)).toBe(
      usdPerTokenFromMarketInfoFormattedPrice(s, 6)
    );
  });
});

/**
 * Regression: SupplyBorrowForm used `humanAmount * 10^(decimals−6) * tokenPrice`, which was
 * correct only for 6-decimal inputs and overstated USD by 100× for 8-decimal assets (e.g. UNIT).
 */
describe("usdValueForHumanTokenAmount", () => {
  it("is human amount × USD/token (no decimal-scaling factor)", () => {
    expect(usdValueForHumanTokenAmount(2.5, 10)).toBe(25);
    expect(usdValueForHumanTokenAmount(1, 0.5)).toBe(0.5);
  });

  it("8-decimal asset: same as 6-decimal when amount and price match (no 100× bug)", () => {
    const humanAmount = 10;
    const usdPerToken = 0.25;
    const correct = usdValueForHumanTokenAmount(humanAmount, usdPerToken);
    const tokenDecimals = 8;
    const oldBuggy =
      humanAmount * (Math.pow(10, tokenDecimals) / Math.pow(10, 6)) * usdPerToken;
    expect(correct).toBe(2.5);
    expect(oldBuggy).toBe(250);
    expect(oldBuggy / correct).toBe(100);
  });

  it("returns 0 for non-positive or non-finite inputs", () => {
    expect(usdValueForHumanTokenAmount(0, 1)).toBe(0);
    expect(usdValueForHumanTokenAmount(-1, 1)).toBe(0);
    expect(usdValueForHumanTokenAmount(1, 0)).toBe(0);
    expect(usdValueForHumanTokenAmount(NaN, 1)).toBe(0);
    expect(usdValueForHumanTokenAmount(1, NaN)).toBe(0);
  });
});
