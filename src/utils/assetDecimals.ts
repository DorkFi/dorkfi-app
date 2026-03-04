/**
 * Pure helpers for asset decimal display and oracle price conversion.
 * See docs/ASSET_DECIMALS_AND_DISPLAY.md for context.
 */

/** Max fraction digits we show for asset amounts (e.g. goBTC has 8). */
const MAX_DISPLAY_DECIMALS = 8;

/**
 * Returns the number of decimal places to show for an asset amount.
 * Used so high-decimal assets (e.g. 8 for goBTC) don't get truncated and users
 * don't think they "lost" dust.
 *
 * @param tokenDecimals - from token config (e.g. 6 or 8)
 * @param defaultDecimals - used when tokenDecimals is undefined (default 6)
 * @returns value in [0, MAX_DISPLAY_DECIMALS]
 */
export function getDisplayDecimals(
  tokenDecimals: number | undefined,
  defaultDecimals: number = 6
): number {
  const decimals = tokenDecimals ?? defaultDecimals;
  return Math.min(Math.max(0, Math.floor(decimals)), MAX_DISPLAY_DECIMALS);
}

/**
 * Oracle stores price in 12-decimal scale. Converts raw price to human-readable
 * token price (USD per 1 token) using the token's decimals.
 *
 * @param rawPrice - from market.price (oracle 12-decimal scale)
 * @param tokenDecimals - from token config (e.g. 6 or 8)
 * @returns USD per 1 token
 */
export function getTokenPriceFromOracle(
  rawPrice: number,
  tokenDecimals: number
): number {
  if (!rawPrice || !Number.isFinite(rawPrice)) return 0;
  const adjustment = 12 - tokenDecimals;
  const divisor = Math.pow(10, adjustment);
  return rawPrice / divisor;
}
