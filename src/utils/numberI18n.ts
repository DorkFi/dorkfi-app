/**
 * Centralized number i18n: format and parse numbers for decimal-point and
 * decimal-comma locales. Uses Intl.NumberFormat for formatting and
 * locale-derived separators for strict parsing.
 */

import { getEffectiveLocale } from "./localeSettings";

export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  signDisplay?: "auto" | "always" | "never" | "exceptZero";
  notation?: "standard" | "scientific" | "compact";
}

export interface FormatCurrencyOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface FormatPercentOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  signDisplay?: "auto" | "always" | "never" | "exceptZero";
}

/** Canonical normalized number regex (optional minus, digits, optional decimal part) */
const NORMALIZED_NUMBER = /^-?\d+(\.\d+)?$/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get the decimal separator for a locale (e.g. "." for en-US, "," for de-DE).
 */
export function getDecimalSeparator(locale: string): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(1.1);
  const match = formatted.match(/[^\d]/);
  return match ? match[0] : ".";
}

/**
 * Get the grouping separator for a locale (e.g. "," for en-US, "." or " " for de-DE/fr-FR).
 */
export function getGroupingSeparator(locale: string): string {
  const formatted = new Intl.NumberFormat(locale).format(1000);
  // Grouping is the first non-digit; could be comma, period, or space
  const match = formatted.match(/[^\d]/);
  return match ? match[0] : ",";
}

/**
 * Format a number using the effective locale (or provided locale).
 */
export function formatNumber(
  value: number,
  options?: FormatNumberOptions,
  locale?: string | null
): string {
  const loc = locale ?? getEffectiveLocale();
  const num = Number(value);
  if (num !== num) return ""; // NaN
  return new Intl.NumberFormat(loc, {
    minimumFractionDigits: options?.minimumFractionDigits,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    signDisplay: options?.signDisplay ?? "auto",
    notation: options?.notation ?? "standard",
  }).format(num);
}

/**
 * Parse user input into a number. Returns null for empty, invalid, or ambiguous input.
 * - Respects locale decimal and grouping separators.
 * - Accepts spaces as group separators (e.g. "1 234,56" in fr-FR).
 * - Handles negatives: "-1234,56" and "(1.234,56)" -> -1234.56.
 * - When both separators appear, the last one must be the locale's decimal separator.
 */
export function parseNumber(
  inputString: string,
  locale?: string | null
): number | null {
  const loc = locale ?? getEffectiveLocale();
  const trimmed = inputString.trim();
  if (trimmed === "") return null;

  const decimalSep = getDecimalSeparator(loc);
  const groupingSep = getGroupingSeparator(loc);

  let str = trimmed;

  // Optional parentheses for negative: (1.234,56) -> -1.234,56
  let negative = false;
  if (str.startsWith("(") && str.endsWith(")")) {
    negative = true;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith("-")) {
    negative = true;
    str = str.slice(1).trim();
  }

  if (str === "" || str === decimalSep || str === groupingSep) return null;

  // Reject if both separators appear in a locale-inconsistent way (e.g. "1,234.56" in de-DE)
  const lastDecimalIdx = str.lastIndexOf(decimalSep);
  const lastGroupingIdx = str.lastIndexOf(groupingSep);
  if (lastDecimalIdx !== -1 && lastGroupingIdx !== -1) {
    const lastSepIdx = Math.max(lastDecimalIdx, lastGroupingIdx);
    const lastChar = str[lastSepIdx];
    if (lastChar !== decimalSep) return null; // last separator must be decimal
  }

  // Normalize: treat spaces as grouping, remove all grouping, then replace decimal with "."
  let normalized = str.replace(/\s/g, groupingSep);
  normalized = normalized.replace(new RegExp(escapeRegex(groupingSep), "g"), "");
  normalized = normalized.replace(new RegExp(escapeRegex(decimalSep), "g"), ".");
  if (negative) normalized = "-" + normalized;

  if (!NORMALIZED_NUMBER.test(normalized)) return null;
  const num = Number(normalized);
  return num === num ? num : null;
}

/**
 * Format a number as currency.
 */
export function formatCurrency(
  value: number,
  currencyCode: string,
  options?: FormatCurrencyOptions,
  locale?: string | null
): string {
  const loc = locale ?? getEffectiveLocale();
  const num = Number(value);
  if (num !== num) return "";
  const minFrac = options?.minimumFractionDigits ?? options?.maximumFractionDigits ?? 2;
  const maxFrac = options?.maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac >= minFrac ? maxFrac : minFrac,
  }).format(num);
}

/**
 * Format a ratio as percentage (value 0.15 -> "15%").
 */
export function formatPercent(
  value: number,
  options?: FormatPercentOptions,
  locale?: string | null
): string {
  const loc = locale ?? getEffectiveLocale();
  const num = Number(value);
  if (num !== num) return "";
  const pct = num * 100;
  const formatted = new Intl.NumberFormat(loc, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    signDisplay: options?.signDisplay ?? "auto",
  }).format(pct);
  return `${formatted}%`;
}
