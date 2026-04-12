/**
 * Helpers for comparing liquidation thresholds across markets in the same lending pool
 * (e.g. deposit modal: new asset vs existing supplied collateral).
 */

import { getAllTokensWithDisplayInfo, type NetworkId } from "@/config";
import {
  fetchMarketInfo,
  fetchUserDepositBalance,
} from "@/services/lendingService";

export type PoolCollateralMarketRow = {
  symbol: string;
  poolId: string;
  liquidationThresholdPercent: number;
  collateralFactorPercent?: number;
};

/** Normalize raw liquidation threshold from API/chain to a 0–1 decimal. */
export function normalizeLiquidationThresholdDecimal(raw: unknown): number {
  if (raw == null) return 0.85;
  let n: number =
    typeof raw === "bigint"
      ? Number(raw)
      : typeof raw === "string"
        ? parseFloat(raw)
        : typeof raw === "number"
          ? raw
          : 0.85;
  if (!Number.isFinite(n)) return 0.85;
  if (n > 1 && n <= 100) return n / 100;
  if (n > 100) return n / 10000;
  return n;
}

export function liquidationThresholdToPercent(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  return normalizeLiquidationThresholdDecimal(raw) * 100;
}

export function collateralFactorToPercent(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return undefined;
  return n > 0 && n <= 1 ? n * 100 : n;
}

type DepositLike = { asset: string; poolId?: string; network?: string };

/** One row per supplied market in the pool (from user deposits), for deposit modal LT comparison. */
export function buildPoolCollateralMarketRows(
  userDeposits: DepositLike[],
  markets: any[],
  networkId: string | undefined,
  poolId: string | undefined
): PoolCollateralMarketRow[] {
  if (!poolId) return [];
  const rows: PoolCollateralMarketRow[] = [];
  const seen = new Set<string>();
  for (const d of userDeposits) {
    const dPool = d.poolId != null ? String(d.poolId) : "";
    if (dPool !== String(poolId)) continue;
    const dNet = d.network;
    if (networkId && dNet && dNet !== networkId) continue;
    const key = `${d.asset}__${dPool}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const m = markets.find(
      (mm: any) =>
        (mm.symbol === d.asset || mm.asset === d.asset) &&
        String(mm.poolId ?? mm.appId) === String(poolId) &&
        (!networkId ||
          !mm.networkId ||
          mm.networkId === networkId ||
          mm.network === networkId)
    );
    if (!m) continue;
    const ltPct = liquidationThresholdToPercent(
      m.liquidationThreshold ?? m.marketInfo?.liquidationThreshold
    );
    const cfPct = collateralFactorToPercent(
      m.collateralFactor ?? m.marketInfo?.collateralFactor
    );
    rows.push({
      symbol: d.asset,
      poolId: String(poolId),
      liquidationThresholdPercent: ltPct ?? 85,
      collateralFactorPercent: cfPct,
    });
  }
  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return rows;
}

/**
 * Markets page: discover supplied markets in a pool via on-chain reads (not paginated table data),
 * then attach liquidation threshold / collateral factor from market info.
 */
export async function fetchPoolCollateralMarketRowsForDeposit(
  userAddress: string | undefined,
  networkId: NetworkId,
  poolId: string | undefined
): Promise<PoolCollateralMarketRow[]> {
  if (!userAddress || poolId == null || poolId === "") return [];

  try {
    const tokens = getAllTokensWithDisplayInfo(networkId).filter(
      (t) =>
        String(t.poolId) === String(poolId) &&
        t.underlyingContractId != null &&
        t.underlyingContractId !== ""
    );

    if (tokens.length === 0) return [];

    const balances = await Promise.all(
      tokens.map((t) =>
        fetchUserDepositBalance(
          userAddress,
          t.poolId!,
          t.underlyingContractId!,
          networkId
        )
      )
    );

    const supplied = tokens.filter((_, i) => (balances[i] ?? 0) > 0);
    if (supplied.length === 0) return [];

    const infos = await Promise.all(
      supplied.map((t) =>
        fetchMarketInfo(t.poolId!, t.underlyingContractId!, networkId)
      )
    );

    const rows: PoolCollateralMarketRow[] = [];
    supplied.forEach((t, i) => {
      const info = infos[i];
      if (!info) return;
      rows.push({
        symbol: t.symbol,
        poolId: String(poolId),
        liquidationThresholdPercent: info.liquidationThreshold * 100,
        collateralFactorPercent: info.collateralFactor * 100,
      });
    });
    rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return rows;
  } catch (e) {
    console.error("fetchPoolCollateralMarketRowsForDeposit:", e);
    return [];
  }
}
