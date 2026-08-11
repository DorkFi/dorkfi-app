/**
 * Session-scoped last-known USD/token for Portfolio positions.
 * Prevents Value (USD) from flashing $0 while market rows rehydrate.
 */

export function portfolioUsdCacheKey(
  networkId: string,
  poolId: string,
  marketId: string
): string {
  return `${networkId}|${poolId}|${marketId}`;
}

const lastGoodPortfolioUsdPerToken = new Map<string, number>();

export function rememberPortfolioUsdPerToken(
  key: string,
  usdPerToken: number
): void {
  if (usdPerToken > 0 && Number.isFinite(usdPerToken)) {
    lastGoodPortfolioUsdPerToken.set(key, usdPerToken);
  }
}

export function recallPortfolioUsdPerToken(key: string): number {
  const stale = lastGoodPortfolioUsdPerToken.get(key);
  return typeof stale === "number" && stale > 0 ? stale : 0;
}

export function resolveWithLastGoodPortfolioUsd(
  usdPerToken: number,
  key: string | null
): number {
  if (usdPerToken > 0 && Number.isFinite(usdPerToken)) {
    if (key) rememberPortfolioUsdPerToken(key, usdPerToken);
    return usdPerToken;
  }
  if (key) {
    const stale = recallPortfolioUsdPerToken(key);
    if (stale > 0) return stale;
  }
  return 0;
}
