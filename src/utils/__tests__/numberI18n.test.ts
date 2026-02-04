/**
 * Unit tests for numberI18n: parseNumber, formatNumber, formatCurrency, formatPercent.
 * Covers decimal-point and decimal-comma locales, negatives, ambiguous/invalid input.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseNumber,
  formatNumber,
  formatCurrency,
  formatPercent,
  getDecimalSeparator,
  getGroupingSeparator,
} from "../numberI18n";
import * as localeSettings from "../localeSettings";

// Mock locale settings so tests are deterministic
const mockGetLocaleSettings = vi.spyOn(localeSettings, "getLocaleSettings");
const mockGetEffectiveLocale = vi.spyOn(localeSettings, "getEffectiveLocale");

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEffectiveLocale.mockImplementation(() => "en-US");
});

describe("getDecimalSeparator / getGroupingSeparator", () => {
  it("en-US: decimal is '.', grouping is ','", () => {
    expect(getDecimalSeparator("en-US")).toBe(".");
    expect(getGroupingSeparator("en-US")).toBe(",");
  });
  it("de-DE: decimal is ',', grouping is '.'", () => {
    expect(getDecimalSeparator("de-DE")).toBe(",");
    expect(getGroupingSeparator("de-DE")).toBe(".");
  });
  it("fr-FR: decimal is ',', grouping can be space or narrow space", () => {
    expect(getDecimalSeparator("fr-FR")).toBe(",");
    const group = getGroupingSeparator("fr-FR");
    expect([" ", "\u202f"]).toContain(group);
  });
});

describe("parseNumber - en-US", () => {
  beforeEach(() => {
    mockGetEffectiveLocale.mockReturnValue("en-US");
  });

  it("parses '1,234.56' as 1234.56", () => {
    expect(parseNumber("1,234.56", "en-US")).toBe(1234.56);
  });
  it("parses '1234.56' as 1234.56", () => {
    expect(parseNumber("1234.56", "en-US")).toBe(1234.56);
  });
  it("parses '-1,234.56' as -1234.56", () => {
    expect(parseNumber("-1,234.56", "en-US")).toBe(-1234.56);
  });
  it("parses '(1,234.56)' as -1234.56", () => {
    expect(parseNumber("(1,234.56)", "en-US")).toBe(-1234.56);
  });
  it("returns null for empty string", () => {
    expect(parseNumber("", "en-US")).toBeNull();
  });
  it("returns null for 'abc'", () => {
    expect(parseNumber("abc", "en-US")).toBeNull();
  });
  it("parses '1.234' as 1.234 (decimal point)", () => {
    expect(parseNumber("1.234", "en-US")).toBe(1.234);
  });
});

describe("parseNumber - de-DE", () => {
  beforeEach(() => {
    mockGetEffectiveLocale.mockReturnValue("de-DE");
  });

  it("parses '1.234,56' as 1234.56", () => {
    expect(parseNumber("1.234,56", "de-DE")).toBe(1234.56);
  });
  it("parses '1234,56' as 1234.56", () => {
    expect(parseNumber("1234,56", "de-DE")).toBe(1234.56);
  });
  it("parses '-1.234,56' as -1234.56", () => {
    expect(parseNumber("-1.234,56", "de-DE")).toBe(-1234.56);
  });
  it("parses '(1.234,56)' as -1234.56", () => {
    expect(parseNumber("(1.234,56)", "de-DE")).toBe(-1234.56);
  });
  it("parses '1,234' as 1.234 (comma is decimal)", () => {
    expect(parseNumber("1,234", "de-DE")).toBe(1.234);
  });
  it("rejects '1,234.56' (mixed en-US style under de-DE)", () => {
    expect(parseNumber("1,234.56", "de-DE")).toBeNull();
  });
});

describe("parseNumber - fr-FR", () => {
  it("parses '1 234,56' as 1234.56", () => {
    expect(parseNumber("1 234,56", "fr-FR")).toBe(1234.56);
  });
});

describe("parseNumber - invalid / ambiguous", () => {
  it("returns null for '1,234' under de-DE (valid: 1.234)", () => {
    expect(parseNumber("1,234", "de-DE")).toBe(1.234);
  });
  it("returns null for '1.234' under en-US (valid: 1.234)", () => {
    expect(parseNumber("1.234", "en-US")).toBe(1.234);
  });
  it("returns null for 'abc'", () => {
    expect(parseNumber("abc", "en-US")).toBeNull();
  });
  it("returns null for ''", () => {
    expect(parseNumber("", "en-US")).toBeNull();
  });
  it("returns null for '1,234.56' under de-DE (wrong locale style)", () => {
    expect(parseNumber("1,234.56", "de-DE")).toBeNull();
  });
  it("returns null for '1.234,56' under en-US (wrong locale style)", () => {
    expect(parseNumber("1.234,56", "en-US")).toBeNull();
  });
});

describe("formatNumber", () => {
  it("formats 1234.56 in en-US with comma thousands", () => {
    const out = formatNumber(1234.56, { maximumFractionDigits: 2 }, "en-US");
    expect(out).toMatch(/1[,.]234/);
    expect(out).toMatch(/56/);
  });
  it("formats 1234.56 in de-DE with period thousands and comma decimal", () => {
    const out = formatNumber(1234.56, { maximumFractionDigits: 2 }, "de-DE");
    expect(out).toContain("1.234");
    expect(out).toContain("56");
  });
});

describe("formatCurrency", () => {
  it("formats 1234.56 USD in en-US", () => {
    const out = formatCurrency(1234.56, "USD", undefined, "en-US");
    expect(out).toMatch(/\$|USD/);
    expect(out).toMatch(/1[,.]234/);
  });
});

describe("formatPercent", () => {
  it("formats 0.15 as 15% in en-US", () => {
    const out = formatPercent(0.15, undefined, "en-US");
    expect(out).toMatch(/15/);
    expect(out).toContain("%");
  });
});

describe("parse + format round-trip", () => {
  it("en-US: format then parse yields same value", () => {
    const value = 1234.56;
    const formatted = formatNumber(value, { maximumFractionDigits: 2 }, "en-US");
    const parsed = parseNumber(formatted, "en-US");
    expect(parsed).toBeCloseTo(value, 10);
  });
  it("de-DE: format then parse yields same value", () => {
    const value = 1234.56;
    const formatted = formatNumber(value, { maximumFractionDigits: 2 }, "de-DE");
    const parsed = parseNumber(formatted, "de-DE");
    expect(parsed).toBeCloseTo(value, 10);
  });
});
