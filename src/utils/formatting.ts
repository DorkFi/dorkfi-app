/**
 * Formatting utilities for numbers, currencies, and percentages.
 * Uses the centralized number i18n utility with the user's effective locale.
 */

import {
  formatNumber as formatNumberI18n,
  formatCurrency as formatCurrencyI18n,
  formatPercent as formatPercentI18n,
} from "./numberI18n";
import { getEffectiveLocale } from "./localeSettings";

export { parseNumber } from "./numberI18n";

/**
 * Format a number with appropriate decimal places and separators (locale-aware).
 */
export const formatNumber = (
  value: string | number,
  decimals: number = 2,
  showSign: boolean = false
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return formatNumberI18n(
    num,
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
      signDisplay: showSign ? "always" : "auto",
    },
    getEffectiveLocale()
  );
};

/**
 * Format a number as currency (locale-aware).
 */
export const formatCurrency = (
  value: string | number,
  currency: string = "USD",
  decimals: number = 2
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return formatCurrencyI18n(
    num,
    currency,
    { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
    getEffectiveLocale()
  );
};

/**
 * Format a number as percentage (locale-aware).
 */
export const formatPercentage = (
  value: string | number,
  decimals: number = 2,
  showSign: boolean = false
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0%";
  return formatPercentI18n(
    num,
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
      signDisplay: showSign ? "always" : "auto",
    },
    getEffectiveLocale()
  );
};

/**
 * Format a large number with appropriate suffixes (K, M, B, T) (locale-aware).
 */
export const formatCompactNumber = (
  value: string | number,
  decimals: number = 1
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat(getEffectiveLocale(), {
    notation: "compact",
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Format a number with specific precision (locale-aware).
 */
export const formatPrecision = (
  value: string | number,
  precision: number
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return formatNumberI18n(
    num,
    { minimumFractionDigits: precision, maximumFractionDigits: precision },
    getEffectiveLocale()
  );
};

/**
 * Format a number as a ratio (e.g., 0.75 -> "75%") (locale-aware).
 */
export const formatRatio = (
  value: string | number,
  decimals: number = 2
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0%";
  return formatPercentage(num, decimals);
};

/**
 * Format a timestamp to a readable date
 */
export const formatDate = (
  timestamp: string | number,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string => {
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) : timestamp);
  
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  return new Intl.DateTimeFormat('en-US', options).format(date);
};

/**
 * Format a duration in seconds to a readable format
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  } else if (seconds < 86400) {
    return `${Math.round(seconds / 3600)}h`;
  } else {
    return `${Math.round(seconds / 86400)}d`;
  }
};

/**
 * Format a number with thousands separators (locale-aware).
 */
export const formatWithSeparators = (
  value: string | number,
  decimals: number = 0
): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat(getEffectiveLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};
