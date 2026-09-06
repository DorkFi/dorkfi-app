/**
 * Resolve pool + market contract ids for Admin market mutations
 * (price, max deposits, max borrows, pause).
 *
 * Prefer the config row (poolId + underlyingContractId). Never look up by
 * symbol alone — duplicate symbols (e.g. two wBTC markets) collide.
 */
export function resolveAdminMarketIds(
  configMarket: {
    poolId?: string;
    underlyingContractId?: string;
  },
  market?: {
    poolId?: string;
    marketInfo?: { poolId?: string; marketId?: string };
  }
): { poolId: string; marketId: string } {
  const poolId =
    configMarket.poolId ||
    market?.marketInfo?.poolId ||
    market?.poolId ||
    "";
  const marketId =
    configMarket.underlyingContractId || market?.marketInfo?.marketId || "";
  return { poolId: String(poolId), marketId: String(marketId) };
}
