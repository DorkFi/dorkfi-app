/**
 * Stable cache key for `walletBalances` when the same display symbol maps to multiple markets
 * (e.g. ALGO vs fALGO both showing as "Algo").
 */
export function portfolioWalletBalanceCacheKey(
  networkId: string,
  parts: {
    marketId?: string | null;
    poolId?: string | null;
    /** Config `tokens` key, e.g. `fALGO` */
    configSymbol?: string | null;
    displaySymbol?: string | null;
  }
): string {
  const pid =
    parts.poolId != null && parts.poolId !== ""
      ? String(parts.poolId)
      : "";
  const mid =
    parts.marketId != null && parts.marketId !== ""
      ? String(parts.marketId)
      : "";
  if (mid !== "" && pid !== "") {
    return `${networkId}|m:${mid}|p:${pid}`;
  }
  const cfg =
    parts.configSymbol != null && parts.configSymbol !== ""
      ? String(parts.configSymbol)
      : "";
  if (cfg !== "" && pid !== "") {
    return `${networkId}|c:${cfg}|p:${pid}`;
  }
  const sym =
    parts.displaySymbol != null && parts.displaySymbol !== ""
      ? String(parts.displaySymbol)
      : "";
  if (pid !== "") {
    return `${networkId}|s:${sym}|p:${pid}`;
  }
  return `${networkId}|s:${sym}`;
}
