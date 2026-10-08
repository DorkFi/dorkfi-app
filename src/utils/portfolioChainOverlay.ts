import {
  getEnabledNetworks,
  getPortfolioVisibleTokens,
  isLpPortfolioPool,
  isLpTmpoolConfigKey,
  type NetworkId,
} from "@/config";
import {
  fetchMarketsByKeys,
  fetchGlobalUserRowsFromChain,
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
  type ChainGlobalUserRow,
  type MarketInfo,
  type UserPositionMarketKey,
} from "@/services/lendingService";
import { usdPerTokenFromPortfolioMarketRow } from "@/utils/assetDecimals";
import { runWithConcurrency } from "@/utils/runWithConcurrency";
import { invalidateUserPositionRpcCache } from "@/utils/rpcReadCache";
import type { PortfolioPositionRow } from "@/types/portfolio";
import { bigintOrZero } from "@/utils/portfolioMissingUserMarkets";

export type GlobalUserLike = {
  network?: unknown;
  poolId?: unknown;
  appId?: unknown;
  totalCollateralValue?: unknown;
  totalBorrowValue?: unknown;
};

export function globalUserRowKey(
  network: unknown,
  poolId: unknown
): string {
  return `${String(network ?? "")}|${String(poolId ?? "")}`;
}

/** Prefer live `get_global_user` rows over the API index, which lags new LP pools. */
export function mergeGlobalUserRowsPreferChain(
  apiRows: GlobalUserLike[] | null | undefined,
  chainRows: ChainGlobalUserRow[]
): ChainGlobalUserRow[] {
  const map = new Map<string, ChainGlobalUserRow>();
  for (const row of apiRows ?? []) {
    const network = String(row.network ?? "");
    const poolId = String(row.poolId ?? row.appId ?? "");
    if (!network || !poolId) continue;
    map.set(globalUserRowKey(network, poolId), {
      network,
      poolId,
      totalCollateralValue: String(row.totalCollateralValue ?? "0"),
      totalBorrowValue: String(row.totalBorrowValue ?? "0"),
    });
  }
  for (const row of chainRows) {
    map.set(globalUserRowKey(row.network, row.poolId), row);
  }
  return [...map.values()];
}

function usdFromGlobalScaled(value: unknown): number {
  return Number(bigintOrZero(value) / 1_000_000_000_000n);
}

export function rowUsdByPoolKey(
  rows: { network?: string; poolId?: string; value?: number }[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = globalUserRowKey(row.network, row.poolId);
    if (key === "|") continue;
    out[key] = (out[key] ?? 0) + (Number(row.value) || 0);
  }
  return out;
}

/**
 * Headline collateral: on-chain `get_global_user` per pool, then API for pools
 * the chain did not return, then visible row sums only for remaining pools.
 * Do not Math.max a stale-high API total over a fresher on-chain value.
 *
 * Debt may still take the max of chain-first vs RPC/rows (conservative).
 */
export function resolvePortfolioHeadlineTotals(opts: {
  chainPools?: GlobalUserLike[] | null;
  apiPools?: GlobalUserLike[] | null;
  rowCollateralUsdByPool?: Record<string, number>;
  rowBorrowUsdByPool?: Record<string, number>;
  rpcBorrowUsd?: number;
}): { totalCollateral: number; totalBorrowed: number } {
  const merged = mergeGlobalUserRowsPreferChain(
    opts.apiPools,
    (opts.chainPools ?? []).map((row) => ({
      network: String(row.network ?? ""),
      poolId: String(row.poolId ?? row.appId ?? ""),
      totalCollateralValue: String(row.totalCollateralValue ?? "0"),
      totalBorrowValue: String(row.totalBorrowValue ?? "0"),
    }))
  );
  const covered = new Set(
    merged.map((row) => globalUserRowKey(row.network, row.poolId))
  );

  let totalCollateral = 0;
  let chainFirstBorrow = 0;
  for (const row of merged) {
    totalCollateral += usdFromGlobalScaled(row.totalCollateralValue);
    chainFirstBorrow += usdFromGlobalScaled(row.totalBorrowValue);
  }

  for (const [key, usd] of Object.entries(opts.rowCollateralUsdByPool ?? {})) {
    if (!covered.has(key)) totalCollateral += usd;
  }
  for (const [key, usd] of Object.entries(opts.rowBorrowUsdByPool ?? {})) {
    if (!covered.has(key)) chainFirstBorrow += usd;
  }

  const allRowBorrows = Object.values(opts.rowBorrowUsdByPool ?? {}).reduce(
    (sum, usd) => sum + usd,
    0
  );
  return {
    totalCollateral,
    totalBorrowed: Math.max(
      chainFirstBorrow,
      opts.rpcBorrowUsd ?? 0,
      allRowBorrows
    ),
  };
}

export function collectLpPortfolioMarketKeys(
  networkId: NetworkId
): UserPositionMarketKey[] {
  const keys: UserPositionMarketKey[] = [];
  for (const token of getPortfolioVisibleTokens(networkId)) {
    const poolId = token.poolId != null ? String(token.poolId) : "";
    const marketId = String(token.underlyingContractId ?? "").trim();
    if (!poolId || !marketId) continue;
    const isLp =
      isLpTmpoolConfigKey(token.configKey) ||
      isLpPortfolioPool(networkId, poolId);
    if (!isLp) continue;
    keys.push({ networkId, poolId, marketId });
  }
  return keys;
}

function tokenPriceFromMarket(
  market: MarketInfo | undefined,
  decimals: number,
  displaySymbol: string
): number {
  if (!market) return 0;
  return usdPerTokenFromPortfolioMarketRow(market, decimals, { displaySymbol });
}

export type PortfolioChainOverlay = {
  globalUserData: ChainGlobalUserRow[];
  positions: PortfolioPositionRow[];
  markets: MarketInfo[];
};

/**
 * Chain reads the API user index often misses: LP pool globals + LP/WAD
 * positions on those pools. Pools page already does this per-card.
 */
export async function fetchPortfolioChainOverlay(
  userAddress: string
): Promise<PortfolioChainOverlay> {
  const networks = getEnabledNetworks() as NetworkId[];
  for (const networkId of networks) {
    invalidateUserPositionRpcCache(networkId, userAddress);
  }

  const globalUserData = await fetchGlobalUserRowsFromChain(userAddress);

  const lpKeys = networks.flatMap((networkId) =>
    collectLpPortfolioMarketKeys(networkId)
  );
  const markets = lpKeys.length > 0 ? await fetchMarketsByKeys(lpKeys) : [];
  const marketByKey = new Map(
    markets.map((m) => [`${m.networkId}|${m.poolId}|${m.marketId}`, m])
  );

  const positions: PortfolioPositionRow[] = [];
  await runWithConcurrency(lpKeys, 6, async (key) => {
    const tokens = getPortfolioVisibleTokens(key.networkId);
    const token = tokens.find(
      (t) =>
        String(t.poolId ?? "") === key.poolId &&
        String(t.underlyingContractId ?? "") === key.marketId
    );
    if (!token?.poolId || !token.underlyingContractId) return;

    const market = marketByKey.get(
      `${key.networkId}|${key.poolId}|${key.marketId}`
    );
    const tokenPrice = tokenPriceFromMarket(
      market,
      token.decimals,
      token.symbol
    );

    const [depositBalance, borrowData] = await Promise.all([
      fetchUserDepositBalance(
        userAddress,
        token.poolId,
        token.underlyingContractId,
        key.networkId
      ),
      fetchUserBorrowBalance(
        userAddress,
        token.poolId,
        token.underlyingContractId,
        key.networkId
      ),
    ]);

    if (depositBalance && depositBalance > 0) {
      positions.push({
        asset: token.symbol,
        originalSymbol: token.originalSymbol ?? token.symbol,
        configSymbol: token.configKey,
        marketId: token.underlyingContractId,
        icon: token.logoPath,
        balance: depositBalance,
        value: depositBalance * tokenPrice,
        apy:
          market?.apyCalculation?.apy ||
          (market?.supplyRate ? market.supplyRate * 100 : 0),
        tokenPrice,
        type: "deposit",
        poolId: token.poolId,
        network: key.networkId,
      });
    }

    const borrowBalance = borrowData?.balance || 0;
    if (borrowBalance > 0) {
      positions.push({
        asset: token.symbol,
        configSymbol: token.configKey,
        marketId: token.underlyingContractId,
        icon: token.logoPath,
        balance: borrowBalance,
        value: borrowBalance * tokenPrice,
        apy:
          market?.borrowApyCalculation?.apy ||
          (market?.borrowRateCurrent ? market.borrowRateCurrent * 100 : 0),
        tokenPrice,
        type: "borrow",
        interest: borrowData?.interest,
        poolId: token.poolId,
        network: key.networkId,
      });
    }
  });

  return { globalUserData, positions, markets };
}
