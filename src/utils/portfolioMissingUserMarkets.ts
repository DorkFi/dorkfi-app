/**
 * Detect lending markets that exist in config for pools the user is in,
 * but are absent from indexer `userData` (not even a 0/0 row).
 *
 * Shared-contract markets (ALGO / WAD on two pools) can be dropped that way.
 * See GitHub #646.
 */

export type PortfolioPoolRef = {
  network?: string;
  poolId?: string | number;
  appId?: string | number;
  totalCollateralValue?: string | number;
  totalBorrowValue?: string | number;
};

export type PortfolioUserMarketRef = {
  network?: string;
  poolId?: string | number;
  appId?: string | number;
  marketId?: string | number;
  underlyingContractId?: string | number;
};

export type PortfolioConfiguredMarketRef = {
  network?: string;
  poolId?: string | number;
  marketId?: string | number;
  underlyingContractId?: string | number;
  originalContractId?: string | number;
};

export type MissingConfiguredMarket = {
  network: string;
  poolId: string;
  marketId: string;
};

function bigintOrZero(value: string | number | undefined | null): bigint {
  try {
    return BigInt(String(value ?? 0));
  } catch {
    return 0n;
  }
}

export function poolHasGlobalPosition(pool: PortfolioPoolRef): boolean {
  return (
    bigintOrZero(pool.totalCollateralValue) > 0n ||
    bigintOrZero(pool.totalBorrowValue) > 0n
  );
}

export function userDataMarketKey(
  poolId: string | number | undefined | null,
  marketId: string | number | undefined | null
): string {
  return `${String(poolId ?? "")}|${String(marketId ?? "")}`;
}

export function configuredMarketsMissingFromUserData(opts: {
  pools: PortfolioPoolRef[];
  userData: PortfolioUserMarketRef[];
  configured: PortfolioConfiguredMarketRef[];
}): MissingConfiguredMarket[] {
  const activePoolNetwork = new Map<string, string>();
  for (const pool of opts.pools) {
    if (!poolHasGlobalPosition(pool)) continue;
    const poolId = String(pool.poolId ?? pool.appId ?? "");
    const network = String(pool.network ?? "").trim();
    if (!poolId || !network) continue;
    activePoolNetwork.set(poolId, network);
  }

  const present = new Set<string>();
  for (const row of opts.userData) {
    const poolId = String(row.poolId ?? row.appId ?? "");
    const marketId = String(row.marketId ?? row.underlyingContractId ?? "");
    if (!poolId || !marketId) continue;
    present.add(userDataMarketKey(poolId, marketId));
  }

  const out: MissingConfiguredMarket[] = [];
  const seen = new Set<string>();
  for (const token of opts.configured) {
    const poolId = String(token.poolId ?? "");
    const marketId = String(
      token.marketId ??
        token.underlyingContractId ??
        token.originalContractId ??
        ""
    );
    if (!poolId || !marketId) continue;
    const network = activePoolNetwork.get(poolId);
    if (!network) continue;
    const key = userDataMarketKey(poolId, marketId);
    if (present.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ network, poolId, marketId });
  }
  return out;
}

export type PortfolioUnionPosition = {
  type?: string;
  network?: string;
  poolId?: string;
  appId?: string;
  marketId?: string;
};

export function portfolioPositionUnionKey(
  row: PortfolioUnionPosition
): string | null {
  const poolId = String(row.poolId ?? row.appId ?? "");
  const marketId = String(row.marketId ?? "");
  const type = String(row.type ?? "");
  if (!type || !poolId || !marketId) return null;
  return `${type}|${String(row.network ?? "")}|${poolId}|${marketId}`;
}

/** Prefer `preferred` rows; append `extra` rows that do not share type+pool+market. */
export function unionPortfolioPositionRows<T extends PortfolioUnionPosition>(
  preferred: T[],
  extra: T[]
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of preferred) {
    const key = portfolioPositionUnionKey(row);
    if (key) seen.add(key);
    out.push(row);
  }
  for (const row of extra) {
    const key = portfolioPositionUnionKey(row);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(row);
  }
  return out;
}
