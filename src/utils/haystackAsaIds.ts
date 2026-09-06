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
  /** Human-readable name for dropdown primary label. */
  name: string;
  label: string;
  decimals: number;
  logoPath: string;
};

/** Symbols excluded from cross-asset repay payment picker. */
const HAYSTACK_PAYMENT_EXCLUDED_SYMBOLS = new Set([
  "TMPOOL2",
  "PEPE",
  "COMPX",
  "SOL",
  "AVAX",
  "LINK",
  "xUSD",
]);

/** ASA ids excluded from cross-asset repay payment picker. */
const HAYSTACK_PAYMENT_EXCLUDED_ASA_IDS = new Set([
  1058926737,
  887406851,
]);

/**
 * Distinct ASA payment options for cross-asset repay on a network.
 * Tinyman LP (TMPOOL2), selected tickers, and specific ASA ids are omitted.
 * Folks f-assets keep their real name/ticker (e.g. Folks V2 USDC / fUSDC)
 * instead of the Markets table override that collapses them to "USDC".
 */
export function listHaystackPaymentAssets(
  networkId: NetworkId,
  excludeAsaId?: number
): HaystackPaymentAssetOption[] {
  const tokens = getAllTokens(networkId);
  const seen = new Set<number>();
  const rows: HaystackPaymentAssetOption[] = [];
  for (const t of tokens) {
    const keepFolksIdentity =
      t.iconBadgeFromSymbol === "FOLKS" || /^Folks\b/i.test(t.name ?? "");
    const sym = keepFolksIdentity
      ? t.symbol
      : (t.marketOverride?.displaySymbol ?? t.symbol);
    if (
      HAYSTACK_PAYMENT_EXCLUDED_SYMBOLS.has(sym) ||
      HAYSTACK_PAYMENT_EXCLUDED_SYMBOLS.has(t.symbol)
    ) {
      continue;
    }
    if (/^TinymanPool2/i.test(t.name ?? "")) continue;
    const id = resolveHaystackAsaId(t);
    if (id == null || seen.has(id)) continue;
    if (excludeAsaId != null && id === excludeAsaId) continue;
    if (HAYSTACK_PAYMENT_EXCLUDED_ASA_IDS.has(id)) continue;
    seen.add(id);
    const name = keepFolksIdentity
      ? (t.name ?? t.symbol)
      : (t.marketOverride?.displayName ?? t.name ?? sym);
    rows.push({
      asaId: id,
      symbol: sym,
      name,
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
