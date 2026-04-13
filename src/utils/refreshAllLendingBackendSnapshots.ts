import {
  getEnabledNetworks,
  getAllTokensWithDisplayInfo,
  isAlgorandCompatibleNetwork,
  type NetworkId,
} from "@/config";
import dorkfiAPIService from "@/services/dorkfiAPIService";
import { fetchMarketInfoFromContract } from "@/services/lendingService";

export type LendingMarketKey = {
  network: NetworkId;
  poolId: string;
  marketId: string;
  symbol?: string;
};

/**
 * Unique lending markets from token config: every enabled network × (poolId + underlying market id).
 */
export function collectDedupedLendingMarketKeys(): LendingMarketKey[] {
  const seen = new Set<string>();
  const out: LendingMarketKey[] = [];
  for (const networkId of getEnabledNetworks()) {
    const nid = networkId as NetworkId;
    const tokens = getAllTokensWithDisplayInfo(nid);
    for (const t of tokens) {
      if (!t.poolId || !t.underlyingContractId) continue;
      const k = `${nid}|${t.poolId}|${t.underlyingContractId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        network: nid,
        poolId: String(t.poolId),
        marketId: String(t.underlyingContractId),
        symbol: t.symbol,
      });
    }
  }
  return out;
}

export type RefreshAllSnapshotsProgress = {
  completed: number;
  total: number;
  currentLabel: string;
};

export type RefreshAllSnapshotsResult = {
  totalMarkets: number;
  fullySucceeded: number;
  partialOrFailed: number;
  failures: Array<{
    key: string;
    label: string;
    issues: string[];
  }>;
};

async function refreshSingle(
  userAddress: string,
  m: LendingMarketKey
): Promise<{ ok: boolean; issues: string[] }> {
  const pool = parseInt(m.poolId, 10);
  const market = parseInt(m.marketId, 10);
  if (!Number.isFinite(pool) || !Number.isFinite(market)) {
    return { ok: false, issues: ["invalid pool or market id"] };
  }

  const issues: string[] = [];

  try {
    const ud = await dorkfiAPIService.fetchFreshUserData(
      userAddress,
      m.network,
      pool,
      market
    );
    if (!ud.success) issues.push("fetchFreshUserData");
  } catch {
    issues.push("fetchFreshUserData");
  }

  if (isAlgorandCompatibleNetwork(m.network)) {
    try {
      const mi = await fetchMarketInfoFromContract(
        m.poolId,
        m.marketId,
        m.network
      );
      if (mi == null) issues.push("fetchMarketInfoFromContract");
    } catch {
      issues.push("fetchMarketInfoFromContract");
    }
  }

  try {
    const uh = await dorkfiAPIService.fetchFreshUserHealth(
      m.network,
      pool,
      userAddress
    );
    if (!uh.success) issues.push("fetchFreshUserHealth");
  } catch {
    issues.push("fetchFreshUserHealth");
  }

  return { ok: issues.length === 0, issues };
}

/**
 * For each configured pool/market on each enabled network: POST fresh user data, POST fresh user health,
 * and read market info from chain (AVM networks only). Runs in concurrent batches to limit load.
 */
export async function refreshAllLendingBackendSnapshots(
  userAddress: string,
  options?: {
    concurrency?: number;
    onProgress?: (p: RefreshAllSnapshotsProgress) => void;
  }
): Promise<RefreshAllSnapshotsResult> {
  const markets = collectDedupedLendingMarketKeys();
  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 4, 16));
  const failures: RefreshAllSnapshotsResult["failures"] = [];
  let fullySucceeded = 0;
  let completed = 0;

  for (let i = 0; i < markets.length; i += concurrency) {
    const chunk = markets.slice(i, i + concurrency);
    const from = i + 1;
    const to = i + chunk.length;
    options?.onProgress?.({
      completed,
      total: markets.length,
      currentLabel: `Markets ${from}–${to} of ${markets.length}`,
    });

    const chunkResults = await Promise.all(
      chunk.map((m) => refreshSingle(userAddress, m))
    );

    for (let j = 0; j < chunk.length; j++) {
      const m = chunk[j];
      const { ok, issues } = chunkResults[j];
      if (ok) {
        fullySucceeded++;
      } else {
        failures.push({
          key: `${m.network}|${m.poolId}|${m.marketId}`,
          label: `${m.symbol ?? "?"} · ${m.network} · pool ${m.poolId}`,
          issues,
        });
      }
    }

    completed += chunk.length;
    options?.onProgress?.({
      completed,
      total: markets.length,
      currentLabel:
        completed >= markets.length
          ? "Done"
          : `Completed ${completed} / ${markets.length}`,
    });
  }

  return {
    totalMarkets: markets.length,
    fullySucceeded,
    partialOrFailed: failures.length,
    failures,
  };
}
