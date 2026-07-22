import type { NetworkId, TokenConfig } from "@/config";
import { getAllTokens, getTokenConfig } from "@/config";

/**
 * Resolve a Tinyman/Haystack ASA id for a token row.
 * ALGO / network native → 0. Returns null when not Haystack-routable.
 *
 * Note: `isStoken` is **not** a blocker — Algorand WAD sToken markets still expose
 * a tradeable ASA id (e.g. 3334160924) that Haystack can route into.
 */
export function resolveHaystackAsaId(
  token: Pick<
    TokenConfig,
    "assetId" | "tokenStandard" | "isStoken" | "marketOverride"
  >
): number | null {
  const standard = token.tokenStandard;
  const overrideUnderlying = token.marketOverride?.underlyingAssetId;
  if (overrideUnderlying && /^\d+$/.test(overrideUnderlying)) {
    return Number(overrideUnderlying);
  }
  if (standard === "network" || standard === "network-asa") {
    const raw = token.assetId ?? "0";
    if (!/^\d+$/.test(raw)) return null;
    return Number(raw);
  }
  if (
    standard === "asa" ||
    standard === "asa-asa" ||
    standard === "arc200-exchange"
  ) {
    const raw = token.assetId;
    if (!raw || !/^\d+$/.test(raw)) return null;
    return Number(raw);
  }
  // Pure ARC200: still accept a numeric assetId when present.
  if (token.assetId && /^\d+$/.test(token.assetId)) {
    return Number(token.assetId);
  }
  return null;
}

/**
 * Best-effort debt ASA for cross-asset repay when the modal has symbol + optional pool.
 */
export function resolveHaystackDebtAsaId(args: {
  networkId: NetworkId;
  tokenSymbol: string;
  poolId?: string;
  repayTokenConfig?: Pick<
    TokenConfig,
    "assetId" | "tokenStandard" | "isStoken" | "marketOverride" | "poolId"
  > | null;
}): number | null {
  if (args.repayTokenConfig) {
    const fromConfig = resolveHaystackAsaId(args.repayTokenConfig);
    if (fromConfig != null) return fromConfig;
  }

  const raw = getTokenConfig(args.networkId, args.tokenSymbol);
  if (!raw) return null;
  const rows = Array.isArray(raw) ? raw : [raw];
  const poolStr =
    args.poolId != null && String(args.poolId).trim() !== ""
      ? String(args.poolId).trim()
      : args.repayTokenConfig?.poolId != null
        ? String(args.repayTokenConfig.poolId).trim()
        : "";
  const preferred =
    (poolStr !== ""
      ? rows.find((r) => String(r.poolId ?? "") === poolStr)
      : undefined) ??
    // Prefer a row that actually resolves to an ASA (skip broken rows).
    rows.find((r) => resolveHaystackAsaId(r) != null) ??
    rows[0];
  return preferred ? resolveHaystackAsaId(preferred) : null;
}

export type HaystackPaymentAssetOption = {
  asaId: number;
  symbol: string;
  label: string;
  decimals: number;
  logoPath: string;
};

/**
 * Distinct ASA payment options for cross-asset repay on a network.
 */
export function listHaystackPaymentAssets(
  networkId: NetworkId,
  excludeAsaId?: number
): HaystackPaymentAssetOption[] {
  const tokens = getAllTokens(networkId);
  const seen = new Set<number>();
  const rows: HaystackPaymentAssetOption[] = [];
  for (const t of tokens) {
    const id = resolveHaystackAsaId(t);
    if (id == null || seen.has(id)) continue;
    if (excludeAsaId != null && id === excludeAsaId) continue;
    seen.add(id);
    const sym = t.marketOverride?.displaySymbol ?? t.symbol;
    rows.push({
      asaId: id,
      symbol: sym,
      label: id === 0 ? `${sym} (ALGO)` : `${sym}`,
      decimals: t.decimals,
      logoPath: t.logoPath,
    });
  }
  rows.sort((a, b) => {
    if (a.asaId === 0) return -1;
    if (b.asaId === 0) return 1;
    return a.label.localeCompare(b.label);
  });
  return rows;
}
