/**
 * Protocol TVL / borrowed using display USD (Tinyman DEX when available,
 * otherwise this market's own oracle) × human deposit/borrow amounts.
 * Amounts come from the bulk market-data API.
 */

import {
  getAllTokensWithDisplayInfo,
  getEnabledNetworks,
  isAlgorandCompatibleNetwork,
  type NetworkId,
} from "@/config";
import {
  buildMarketInfoFromRawMarketData,
  fetchBulkApiMarketDataMap,
  fetchMarketsByKeys,
  marketDataLookupKey,
  type MarketData,
  type MarketInfo,
  type UserPositionMarketKey,
} from "@/services/lendingService";
import { fetchTinymanAssetUsdMap } from "@/services/tinymanAssetUsd";
import { usdPerTokenFromPortfolioMarketRow } from "@/utils/assetDecimals";
import { overlayUsdWithDisplayPrice, isDisplayUsdNetwork } from "@/utils/displayUsdPerToken";
import {
  collectAlgorandMainnetDisplayAsaIds,
  resolveAsaIdForDisplayUsd,
} from "@/utils/resolveAsaIdForDisplayUsd";
import {
  analyticsMarketUsdKey,
  sumProtocolUsdTotals,
  type AnalyticsMarketUsdQuote,
  type ProtocolUsdTotals,
} from "@/utils/analyticsProtocolTvl";
import { runWithConcurrency } from "@/utils/runWithConcurrency";

const ORACLE_TVL_CACHE_TTL_MS = 60_000;
const ORACLE_REFINE_CONCURRENCY = 6;
const SESSION_CACHE_KEY = "dorkfi:analytics:oracle-protocol-totals";

export interface OracleBasedProtocolTotals extends ProtocolUsdTotals {
  fetchedAt: number;
}

let cachedTotals: OracleBasedProtocolTotals | null = null;
let inFlight: Promise<OracleBasedProtocolTotals | null> | null = null;
let cachedHydratedMarkets: { markets: MarketInfo[]; fetchedAt: number } | null =
  null;
let hydrateInFlight: Promise<MarketInfo[] | null> | null = null;

function isFreshTotals(totals: OracleBasedProtocolTotals): boolean {
  return (
    Number.isFinite(totals.fetchedAt) &&
    Date.now() - totals.fetchedAt < ORACLE_TVL_CACHE_TTL_MS &&
    totals.tvl > 0
  );
}

function readSessionCache(): OracleBasedProtocolTotals | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OracleBasedProtocolTotals;
    if (!isFreshTotals(parsed)) {
      sessionStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(totals: OracleBasedProtocolTotals): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(totals));
  } catch {
    // quota / private mode
  }
}

/** Sync read for instant paint (memory → sessionStorage). */
export function peekCachedOracleProtocolTotals(): OracleBasedProtocolTotals | null {
  if (cachedTotals && isFreshTotals(cachedTotals)) {
    return cachedTotals;
  }
  const session = readSessionCache();
  if (session) {
    cachedTotals = session;
    return session;
  }
  return null;
}

function marketUsdPerToken(market: MarketInfo): number {
  return usdPerTokenFromPortfolioMarketRow(market, market.decimals || 6, {
    displaySymbol: market.symbol,
  });
}

function marketDisplayUsdPerToken(
  market: MarketInfo,
  dexUsdByAsaId: Map<number, number>
): number {
  const protocolUsd = marketUsdPerToken(market);
  if (!isDisplayUsdNetwork(market.networkId) || dexUsdByAsaId.size === 0) {
    return protocolUsd;
  }
  const asaId = resolveAsaIdForDisplayUsd({
    networkId: market.networkId,
    poolId: market.poolId,
    marketId: market.marketId,
    displaySymbol: market.symbol,
  });
  const dexUsd = asaId != null ? dexUsdByAsaId.get(asaId) : undefined;
  return overlayUsdWithDisplayPrice(protocolUsd, dexUsd);
}

async function fetchDisplayUsdByAsaId(): Promise<Map<number, number>> {
  try {
    return await fetchTinymanAssetUsdMap(collectAlgorandMainnetDisplayAsaIds());
  } catch {
    return new Map();
  }
}

async function hydrateNetworkMarkets(
  networkId: NetworkId
): Promise<MarketInfo[]> {
  const tokens = getAllTokensWithDisplayInfo(networkId);
  let bulkMap: Map<string, MarketData> | null = null;
  try {
    bulkMap = await fetchBulkApiMarketDataMap(networkId);
  } catch (error) {
    console.warn(
      `[analyticsProtocolTvl] bulk market-data failed for ${networkId}`,
      error
    );
  }

  const jobs: Array<{
    poolId: string;
    marketId: string;
    raw: MarketData;
  }> = [];
  const missingKeys: UserPositionMarketKey[] = [];

  for (const token of tokens) {
    const poolId = token.poolId != null ? String(token.poolId) : "";
    const marketId = String(
      token.underlyingContractId ||
        token.underlyingAssetId ||
        token.originalContractId ||
        ""
    ).trim();
    if (!poolId || !marketId) continue;

    const raw = bulkMap?.get(marketDataLookupKey(poolId, marketId));
    if (!raw) {
      missingKeys.push({ networkId, poolId, marketId });
      continue;
    }
    jobs.push({ poolId, marketId, raw });
  }

  const markets: MarketInfo[] = [];
  await runWithConcurrency(jobs, ORACLE_REFINE_CONCURRENCY, async (job) => {
    try {
      const marketInfo = await buildMarketInfoFromRawMarketData(
        job.raw,
        job.poolId,
        job.marketId,
        networkId,
        { applyOracle: true }
      );
      if (marketInfo) markets.push(marketInfo);
    } catch (error) {
      console.warn(
        `[analyticsProtocolTvl] oracle build failed ${networkId}/${job.poolId}/${job.marketId}`,
        error
      );
    }
  });

  if (missingKeys.length > 0) {
    const gapFilled = await fetchMarketsByKeys(missingKeys, {
      concurrency: ORACLE_REFINE_CONCURRENCY,
    });
    markets.push(...gapFilled);
  }

  return markets;
}

async function fetchHydratedAnalyticsMarkets(): Promise<MarketInfo[] | null> {
  if (
    cachedHydratedMarkets &&
    Date.now() - cachedHydratedMarkets.fetchedAt < ORACLE_TVL_CACHE_TTL_MS &&
    cachedHydratedMarkets.markets.length > 0
  ) {
    return cachedHydratedMarkets.markets;
  }
  if (hydrateInFlight) return hydrateInFlight;

  hydrateInFlight = (async () => {
    const networks = getEnabledNetworks().filter(isAlgorandCompatibleNetwork);
    const perNetwork = await Promise.all(
      networks.map((networkId) => hydrateNetworkMarkets(networkId))
    );
    const markets = perNetwork.flat();
    if (markets.length === 0) return null;
    cachedHydratedMarkets = { markets, fetchedAt: Date.now() };
    return markets;
  })().finally(() => {
    hydrateInFlight = null;
  });

  return hydrateInFlight;
}

export function buildAnalyticsMarketUsdLookup(
  markets: MarketInfo[],
  dexUsdByAsaId?: Map<number, number>
): Map<string, AnalyticsMarketUsdQuote> {
  const lookup = new Map<string, AnalyticsMarketUsdQuote>();
  const dex = dexUsdByAsaId ?? new Map<number, number>();
  for (const market of markets) {
    const usdPerToken = marketDisplayUsdPerToken(market, dex);
    if (!(usdPerToken > 0)) continue;
    const key = analyticsMarketUsdKey(market.networkId, market.marketId);
    if (!lookup.has(key)) {
      lookup.set(key, {
        decimals: market.decimals || 6,
        usdPerToken,
      });
    }
  }
  return lookup;
}

/** Display USD/token + decimals keyed by `network|marketId`. */
export async function fetchAnalyticsMarketUsdLookup(): Promise<
  Map<string, AnalyticsMarketUsdQuote>
> {
  const [markets, dexUsdByAsaId] = await Promise.all([
    fetchHydratedAnalyticsMarkets(),
    fetchDisplayUsdByAsaId(),
  ]);
  return buildAnalyticsMarketUsdLookup(markets ?? [], dexUsdByAsaId);
}

async function computeOracleBasedProtocolTotals(): Promise<OracleBasedProtocolTotals | null> {
  const [markets, dexUsdByAsaId] = await Promise.all([
    fetchHydratedAnalyticsMarkets(),
    fetchDisplayUsdByAsaId(),
  ]);
  if (!markets || markets.length === 0) return null;

  const totals = sumProtocolUsdTotals(
    markets.map((market) => ({
      totalDeposits: market.totalDeposits,
      totalBorrows: market.totalBorrows,
      usdPerToken: marketDisplayUsdPerToken(market, dexUsdByAsaId),
    }))
  );
  if (!(totals.tvl > 0)) return null;

  return {
    ...totals,
    fetchedAt: Date.now(),
  };
}

/**
 * Live protocol TVL and borrowed (display USD × human deposit/borrow amounts).
 * Dedupes concurrent callers and caches for {@link ORACLE_TVL_CACHE_TTL_MS}.
 */
export async function fetchOracleBasedProtocolTotals(): Promise<OracleBasedProtocolTotals | null> {
  const peek = peekCachedOracleProtocolTotals();
  if (peek) return peek;
  if (inFlight) return inFlight;

  inFlight = computeOracleBasedProtocolTotals()
    .then((result) => {
      if (result) {
        cachedTotals = result;
        writeSessionCache(result);
      }
      return result;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
