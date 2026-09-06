/**
 * Fast Portfolio market hydrate: bulk API Phase A (no oracle) → paint,
 * then background Phase B oracle refine. Mirrors Markets `useOnDemandMarketData`
 * so Value (USD) / APY appear in ~1 RTT instead of N×(GET+oracle).
 */

import {
  getAllTokensWithDisplayInfo,
  filterPortfolioVisibleMarketRows,
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
import { runWithConcurrency } from "@/utils/runWithConcurrency";

function marketDataRowKey(row: unknown): string {
  const m = row as {
    networkId?: string;
    poolId?: string | number;
    appId?: string | number;
    marketId?: string | number;
  };
  return `${String(m.networkId ?? "")}|${String(m.poolId ?? m.appId ?? "")}|${String(m.marketId ?? "")}`;
}

function hasOracleUsd(row: unknown): boolean {
  const o = (row as MarketInfo).oracleUsdPerToken;
  return typeof o === "number" && Number.isFinite(o) && o > 0;
}

/**
 * Merge market rows by network|pool|market key.
 * Prefer oracle-refined rows over Phase A bulk (applyOracle: false) so a
 * user-data refresh cannot clobber Phase B prices with cheaper bulk USD.
 */
export function mergePortfolioMarketRows(
  prev: unknown[],
  next: unknown[]
): unknown[] {
  const map = new Map<string, unknown>();
  for (const row of prev) {
    map.set(marketDataRowKey(row), row);
  }
  for (const row of next) {
    const key = marketDataRowKey(row);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, row);
      continue;
    }
    // Keep Phase B / oracle-refined pricing when incoming is bulk-only.
    if (hasOracleUsd(existing) && !hasOracleUsd(row)) {
      continue;
    }
    const existingMi = existing as MarketInfo;
    const incomingMi = row as MarketInfo;
    const existingUsd = usdPerTokenFromPortfolioMarketRow(
      existing,
      existingMi.decimals ?? 6,
      { displaySymbol: existingMi.symbol }
    );
    const incomingUsd = usdPerTokenFromPortfolioMarketRow(
      row,
      incomingMi.decimals ?? 6,
      { displaySymbol: incomingMi.symbol }
    );
    // Prefer a row with a usable price; otherwise take the fresher incoming snapshot.
    if (incomingUsd > 0 || existingUsd <= 0) {
      map.set(key, row);
    }
  }
  return [...map.values()];
}

const PORTFOLIO_MARKETS_SESSION_TTL_MS = 60_000;
const MARKETS_TABLE_SESSION_TTL_MS = 60_000;
const REFINE_CONCURRENCY = 6;

function portfolioMarketsSessionKey(networkId: NetworkId): string {
  return `dorkfi:portfolioMarkets:${networkId}`;
}

function marketsTableSessionKey(networkId: NetworkId): string {
  return `dorkfi:marketsHydrate:${networkId}`;
}

/** Instant paint from last Portfolio Phase A/B snapshot. */
export function readPortfolioMarketsSessionCache(
  networkId: NetworkId
): MarketInfo[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(portfolioMarketsSessionKey(networkId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: MarketInfo[];
    };
    if (
      !parsed?.savedAt ||
      !Array.isArray(parsed.data) ||
      Date.now() - parsed.savedAt > PORTFOLIO_MARKETS_SESSION_TTL_MS
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writePortfolioMarketsSessionCache(
  networkId: NetworkId,
  markets: MarketInfo[]
): void {
  if (typeof sessionStorage === "undefined" || markets.length === 0) return;
  try {
    sessionStorage.setItem(
      portfolioMarketsSessionKey(networkId),
      JSON.stringify({ savedAt: Date.now(), data: markets })
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/**
 * Reuse Markets table hydrate cache when the user visited Markets first.
 * Extracts embedded `marketInfo` rows only.
 */
export function marketInfosFromMarketsTableSession(
  networkId: NetworkId
): MarketInfo[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(marketsTableSessionKey(networkId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: Record<string, { marketInfo?: MarketInfo; isLoaded?: boolean }>;
    };
    if (
      !parsed?.savedAt ||
      !parsed.data ||
      Date.now() - parsed.savedAt > MARKETS_TABLE_SESSION_TTL_MS
    ) {
      return [];
    }
    const out: MarketInfo[] = [];
    for (const row of Object.values(parsed.data)) {
      if (row?.isLoaded && row.marketInfo?.marketId && row.marketInfo?.poolId) {
        out.push(row.marketInfo);
      }
    }
    return filterPortfolioVisibleMarketRows(networkId, out);
  } catch {
    return [];
  }
}

export type PortfolioOracleRefineJob = {
  networkId: NetworkId;
  poolId: string;
  marketId: string;
  raw: MarketData;
};

export type PortfolioBulkHydrateResult = {
  markets: MarketInfo[];
  refineJobs: PortfolioOracleRefineJob[];
  /** Position/token keys missing from bulk — gap-fill with per-market GET. */
  missingKeys: UserPositionMarketKey[];
};

/**
 * Phase A: one bulk GET + CPU build (no oracle RPC) → MarketInfo[] ready to paint.
 */
export async function hydratePortfolioNetworkMarketsPhaseA(
  networkId: NetworkId
): Promise<PortfolioBulkHydrateResult> {
  const tokens = getAllTokensWithDisplayInfo(networkId);
  let bulkMap: Map<string, MarketData> | null = null;
  try {
    bulkMap = await fetchBulkApiMarketDataMap(networkId);
  } catch (e) {
    console.warn(
      `[portfolioMarketHydrate] bulk fetch failed for ${networkId}; gap-fill only`,
      e
    );
  }

  const markets: MarketInfo[] = [];
  const refineJobs: PortfolioOracleRefineJob[] = [];
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

    try {
      const marketInfo = await buildMarketInfoFromRawMarketData(
        raw,
        poolId,
        marketId,
        networkId,
        { applyOracle: false }
      );
      if (!marketInfo) {
        missingKeys.push({ networkId, poolId, marketId });
        continue;
      }
      markets.push(marketInfo);
      refineJobs.push({ networkId, poolId, marketId, raw });
    } catch (error) {
      console.warn(
        `[portfolioMarketHydrate] Phase A build failed ${networkId}/${poolId}/${marketId}`,
        error
      );
      missingKeys.push({ networkId, poolId, marketId });
    }
  }

  return {
    markets: filterPortfolioVisibleMarketRows(networkId, markets),
    refineJobs,
    missingKeys,
  };
}

/**
 * Phase B: oracle refine in background (capped concurrency). Calls `onMarket`
 * as each market completes so Portfolio can merge without waiting for all.
 */
export async function refinePortfolioMarketsPhaseB(
  jobs: PortfolioOracleRefineJob[],
  onMarket: (market: MarketInfo) => void,
  isCancelled?: () => boolean
): Promise<void> {
  if (jobs.length === 0) return;
  await runWithConcurrency(jobs, REFINE_CONCURRENCY, async (job) => {
    if (isCancelled?.()) return;
    try {
      const marketInfo = await buildMarketInfoFromRawMarketData(
        job.raw,
        job.poolId,
        job.marketId,
        job.networkId,
        { applyOracle: true }
      );
      if (isCancelled?.() || !marketInfo) return;
      onMarket(marketInfo);
    } catch (error) {
      console.warn(
        `[portfolioMarketHydrate] Phase B refine failed ${job.networkId}/${job.poolId}/${job.marketId}`,
        error
      );
    }
  });
}

/**
 * Gap-fill keys missing from bulk (prefer position keys). Uses capped parallel GETs.
 */
export async function gapFillPortfolioMarkets(
  keys: UserPositionMarketKey[],
  options?: { concurrency?: number }
): Promise<MarketInfo[]> {
  if (keys.length === 0) return [];
  const markets = await fetchMarketsByKeys(keys, {
    concurrency: options?.concurrency ?? REFINE_CONCURRENCY,
  });
  const byNetwork = new Map<NetworkId, MarketInfo[]>();
  for (const m of markets) {
    const list = byNetwork.get(m.networkId) ?? [];
    list.push(m);
    byNetwork.set(m.networkId, list);
  }
  const visible: MarketInfo[] = [];
  for (const [networkId, list] of byNetwork) {
    visible.push(...filterPortfolioVisibleMarketRows(networkId, list));
  }
  return visible;
}
