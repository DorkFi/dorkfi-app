/**
 * Protocol TVL / borrowed for Analytics.
 *
 * Two price paths:
 * - Fast: bulk `/market-data` prices only (no per-market oracle RPC) — used by
 *   activity charts (withdrawals need USD conversion).
 * - Oracle: Markets-accurate overlay for KPI refine after first paint.
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
import { usdPerTokenFromPortfolioMarketRow } from "@/utils/assetDecimals";
import {
  analyticsMarketUsdKey,
  sumProtocolUsdTotals,
  type AnalyticsMarketUsdQuote,
  type ProtocolUsdTotals,
} from "@/utils/analyticsProtocolTvl";
import { runWithConcurrency } from "@/utils/runWithConcurrency";

const ORACLE_TVL_CACHE_TTL_MS = 60_000;
const HYDRATE_CONCURRENCY = 8;
const SESSION_CACHE_KEY = "dorkfi:analytics:oracle-protocol-totals";

export interface OracleBasedProtocolTotals extends ProtocolUsdTotals {
  fetchedAt: number;
}

type HydrateMode = "fast" | "oracle";

let cachedTotals: OracleBasedProtocolTotals | null = null;
let oracleTotalsInFlight: Promise<OracleBasedProtocolTotals | null> | null =
  null;
let bulkTotalsInFlight: Promise<OracleBasedProtocolTotals | null> | null = null;

let cachedFastMarkets: { markets: MarketInfo[]; fetchedAt: number } | null =
  null;
let cachedOracleMarkets: { markets: MarketInfo[]; fetchedAt: number } | null =
  null;
let fastHydrateInFlight: Promise<MarketInfo[] | null> | null = null;
let oracleHydrateInFlight: Promise<MarketInfo[] | null> | null = null;

function isFreshTotals(totals: OracleBasedProtocolTotals): boolean {
  return (
    Number.isFinite(totals.fetchedAt) &&
    Date.now() - totals.fetchedAt < ORACLE_TVL_CACHE_TTL_MS &&
    totals.tvl > 0
  );
}

function isFreshMarkets(entry: {
  markets: MarketInfo[];
  fetchedAt: number;
}): boolean {
  return (
    Date.now() - entry.fetchedAt < ORACLE_TVL_CACHE_TTL_MS &&
    entry.markets.length > 0
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

async function hydrateNetworkMarkets(
  networkId: NetworkId,
  mode: HydrateMode
): Promise<MarketInfo[]> {
  const applyOracle = mode === "oracle";
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
  await runWithConcurrency(jobs, HYDRATE_CONCURRENCY, async (job) => {
    try {
      const marketInfo = await buildMarketInfoFromRawMarketData(
        job.raw,
        job.poolId,
        job.marketId,
        networkId,
        { applyOracle }
      );
      if (marketInfo) markets.push(marketInfo);
    } catch (error) {
      console.warn(
        `[analyticsProtocolTvl] ${mode} build failed ${networkId}/${job.poolId}/${job.marketId}`,
        error
      );
    }
  });

  // Gap-fill only for oracle path — fetchMarketsByKeys applies oracle pricing.
  if (applyOracle && missingKeys.length > 0) {
    const gapFilled = await fetchMarketsByKeys(missingKeys, {
      concurrency: HYDRATE_CONCURRENCY,
    });
    markets.push(...gapFilled);
  }

  return markets;
}

async function fetchHydratedAnalyticsMarkets(
  mode: HydrateMode
): Promise<MarketInfo[] | null> {
  if (mode === "fast") {
    if (cachedFastMarkets && isFreshMarkets(cachedFastMarkets)) {
      return cachedFastMarkets.markets;
    }
    // Prefer oracle cache if already warm — prices are at least as good.
    if (cachedOracleMarkets && isFreshMarkets(cachedOracleMarkets)) {
      return cachedOracleMarkets.markets;
    }
    if (fastHydrateInFlight) return fastHydrateInFlight;

    fastHydrateInFlight = (async () => {
      const networks = getEnabledNetworks().filter(isAlgorandCompatibleNetwork);
      const perNetwork = await Promise.all(
        networks.map((networkId) => hydrateNetworkMarkets(networkId, "fast"))
      );
      const markets = perNetwork.flat();
      if (markets.length === 0) return null;
      cachedFastMarkets = { markets, fetchedAt: Date.now() };
      return markets;
    })().finally(() => {
      fastHydrateInFlight = null;
    });

    return fastHydrateInFlight;
  }

  if (cachedOracleMarkets && isFreshMarkets(cachedOracleMarkets)) {
    return cachedOracleMarkets.markets;
  }
  if (oracleHydrateInFlight) return oracleHydrateInFlight;

  oracleHydrateInFlight = (async () => {
    const networks = getEnabledNetworks().filter(isAlgorandCompatibleNetwork);
    const perNetwork = await Promise.all(
      networks.map((networkId) => hydrateNetworkMarkets(networkId, "oracle"))
    );
    const markets = perNetwork.flat();
    if (markets.length === 0) return null;
    cachedOracleMarkets = { markets, fetchedAt: Date.now() };
    // Oracle results also satisfy fast consumers.
    cachedFastMarkets = cachedOracleMarkets;
    return markets;
  })().finally(() => {
    oracleHydrateInFlight = null;
  });

  return oracleHydrateInFlight;
}

export function buildAnalyticsMarketUsdLookup(
  markets: MarketInfo[]
): Map<string, AnalyticsMarketUsdQuote> {
  const lookup = new Map<string, AnalyticsMarketUsdQuote>();
  for (const market of markets) {
    const usdPerToken = marketUsdPerToken(market);
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

/**
 * Fast USD/token lookup from bulk market-data prices (no oracle RPC).
 * Prefer this for activity charts so withdrawals aren't blocked on N oracle calls.
 */
export async function fetchAnalyticsMarketUsdLookup(): Promise<
  Map<string, AnalyticsMarketUsdQuote>
> {
  const markets = await fetchHydratedAnalyticsMarkets("fast");
  return buildAnalyticsMarketUsdLookup(markets ?? []);
}

/**
 * Oracle-priced USD lookup for a specific set of markets (e.g. withdrawal rows).
 * Much cheaper than hydrating every configured market when only ~20 ids appear in activity.
 */
export async function fetchOracleMarketUsdLookupForRefs(
  refs: Array<{
    network?: string;
    marketId?: string | number;
    poolId?: string | number;
    appId?: string | number;
  }>
): Promise<Map<string, AnalyticsMarketUsdQuote>> {
  // Reuse full oracle cache when already warm.
  if (cachedOracleMarkets && isFreshMarkets(cachedOracleMarkets)) {
    return buildAnalyticsMarketUsdLookup(cachedOracleMarkets.markets);
  }

  const keys: UserPositionMarketKey[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const networkId = ref.network as NetworkId | undefined;
    const marketId = String(ref.marketId ?? "").trim();
    if (!networkId || !marketId || !isAlgorandCompatibleNetwork(networkId)) {
      continue;
    }

    let poolId = String(ref.poolId ?? ref.appId ?? "").trim();
    if (!poolId) {
      const token = getAllTokensWithDisplayInfo(networkId).find((t) => {
        const id = String(
          t.underlyingContractId ||
            t.underlyingAssetId ||
            t.originalContractId ||
            ""
        ).trim();
        return id === marketId;
      });
      poolId = token?.poolId != null ? String(token.poolId) : "";
    }
    if (!poolId) continue;

    const dedupe = `${networkId}|${poolId}|${marketId}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    keys.push({ networkId, poolId, marketId });
  }

  if (keys.length === 0) {
    return fetchAnalyticsMarketUsdLookup();
  }

  const markets = await fetchMarketsByKeys(keys, {
    concurrency: HYDRATE_CONCURRENCY,
  });
  return buildAnalyticsMarketUsdLookup(markets);
}

function totalsFromMarkets(
  markets: MarketInfo[]
): OracleBasedProtocolTotals | null {
  const totals = sumProtocolUsdTotals(
    markets.map((market) => ({
      totalDeposits: market.totalDeposits,
      totalBorrows: market.totalBorrows,
      usdPerToken: marketUsdPerToken(market),
    }))
  );
  if (!(totals.tvl > 0)) return null;
  return {
    ...totals,
    fetchedAt: Date.now(),
  };
}

/**
 * Protocol totals from bulk market-data prices (no oracle RPC).
 * Use for a fast KPI refine before the slower oracle path finishes.
 */
export async function fetchBulkBasedProtocolTotals(): Promise<OracleBasedProtocolTotals | null> {
  if (bulkTotalsInFlight) return bulkTotalsInFlight;

  bulkTotalsInFlight = (async () => {
    const markets = await fetchHydratedAnalyticsMarkets("fast");
    if (!markets || markets.length === 0) return null;
    return totalsFromMarkets(markets);
  })().finally(() => {
    bulkTotalsInFlight = null;
  });

  return bulkTotalsInFlight;
}

async function computeOracleBasedProtocolTotals(): Promise<OracleBasedProtocolTotals | null> {
  const markets = await fetchHydratedAnalyticsMarkets("oracle");
  if (!markets || markets.length === 0) return null;
  return totalsFromMarkets(markets);
}

/**
 * Live protocol TVL and borrowed (oracle USD × human deposit/borrow amounts).
 * Dedupes concurrent callers and caches for {@link ORACLE_TVL_CACHE_TTL_MS}.
 */
export async function fetchOracleBasedProtocolTotals(): Promise<OracleBasedProtocolTotals | null> {
  const peek = peekCachedOracleProtocolTotals();
  if (peek) return peek;
  if (oracleTotalsInFlight) return oracleTotalsInFlight;

  oracleTotalsInFlight = computeOracleBasedProtocolTotals()
    .then((result) => {
      if (result) {
        cachedTotals = result;
        writeSessionCache(result);
      }
      return result;
    })
    .finally(() => {
      oracleTotalsInFlight = null;
    });

  return oracleTotalsInFlight;
}

/** Test helper */
export function __resetAnalyticsProtocolTvlCacheForTests(): void {
  cachedTotals = null;
  oracleTotalsInFlight = null;
  bulkTotalsInFlight = null;
  cachedFastMarkets = null;
  cachedOracleMarkets = null;
  fastHydrateInFlight = null;
  oracleHydrateInFlight = null;
}
