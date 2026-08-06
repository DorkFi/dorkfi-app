/**
 * Easy Savings market routing: maps a supply asset onto a DorkFi pool market.
 */
import {
  getLendingPoolLabel,
  getMarketLabel,
  getNetworkConfig,
  getUnitLendingWadBorrowMarketRef,
  getUsdcLpLendingWadBorrowMarketRef,
  getWadLpLendingWadBorrowMarketRef,
  type NetworkId,
  type TokenConfig,
} from "@/config";
import type {
  EasySavingsMarketRef,
  ResolveSavingsRouteInput,
  SavingsRoute,
} from "@/types/easySavings";

/**
 * Core savings deposit assets (single-asset markets).
 * Pass `null` to {@link listSavingsRoutes} `assetConfigKeys` for every depositable asset.
 */
export const EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS = ["USDC"] as const;

/**
 * Higher-yield pooled LP markets (elevated risk vs core savings).
 */
export const EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS = [
  "LP_TMPOOL2_WAD_USDC",
] as const;

/** All curated Easy Savings deposit keys (core + high-yield). */
export const EASY_SAVINGS_V1_ASSET_CONFIG_KEYS = [
  ...EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS,
  ...EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS,
] as const;

export type EasySavingsCoreAssetConfigKey =
  (typeof EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS)[number];

export type EasySavingsHighYieldAssetConfigKey =
  (typeof EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS)[number];

export type EasySavingsV1AssetConfigKey =
  (typeof EASY_SAVINGS_V1_ASSET_CONFIG_KEYS)[number];

export function isEasySavingsV1AssetConfigKey(
  key: string
): key is EasySavingsV1AssetConfigKey {
  return (EASY_SAVINGS_V1_ASSET_CONFIG_KEYS as readonly string[]).includes(key);
}

export function isEasySavingsHighYieldAssetConfigKey(
  key: string
): key is EasySavingsHighYieldAssetConfigKey {
  return (
    EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS as readonly string[]
  ).includes(key);
}

/** Human label for sidebar / hero (LP rows use pair names, not TMPOOL2). */
export function savingsAccountDisplayLabel(route: SavingsRoute): string {
  switch (route.asset.configKey) {
    case "LP_TMPOOL2_WAD_USDC":
      return "USDC / WAD";
    case "LP_TMPOOL2_UNIT_ALGO":
      return "UNIT / ALGO";
    case "fUSDC":
      return route.marketLabel === "D" ? "Pool D USDC" : "USDC";
    default:
      return route.asset.symbol;
  }
}

export type ListSavingsRoutesOptions = {
  /**
   * Defaults to {@link EASY_SAVINGS_V1_ASSET_CONFIG_KEYS}.
   * Pass `null` for every depositable listing on active pools.
   */
  assetConfigKeys?: readonly string[] | null;
};

function toMarketRef(
  configKey: string,
  token: TokenConfig
): EasySavingsMarketRef {
  return {
    configKey,
    poolId: String(token.poolId),
    contractId: String(token.contractId),
    nTokenId: String(token.nTokenId),
    symbol: token.marketOverride?.displaySymbol ?? token.symbol,
    decimals: token.decimals,
    tokenStandard: token.tokenStandard,
    logoPath: token.logoPath,
  };
}

function isActiveLendingPool(
  networkId: NetworkId,
  poolId: string | undefined
): boolean {
  if (!poolId) return false;
  return getMarketLabel(networkId, poolId) != null;
}

function isDepositable(token: TokenConfig): boolean {
  return Boolean(token.poolId && token.contractId && token.nTokenId);
}

/**
 * WAD rows that are mint/borrow-oriented (stoken or C/E/F LP borrow markets)
 * should not appear as Savings supply destinations.
 */
export function isWadSavingsEligible(
  networkId: NetworkId,
  token: TokenConfig
): boolean {
  if (token.isStoken) return false;
  const borrowRefs = [
    getUnitLendingWadBorrowMarketRef(networkId),
    getWadLpLendingWadBorrowMarketRef(networkId),
    getUsdcLpLendingWadBorrowMarketRef(networkId),
  ].filter(Boolean);
  return !borrowRefs.some(
    (ref) =>
      ref &&
      String(token.poolId) === ref.poolId &&
      String(token.contractId) === ref.contractId &&
      String(token.nTokenId) === ref.nTokenId
  );
}

/**
 * Prefer native ALGO rows over Folks fALGO (same config key, different symbol).
 */
function isAlgoSavingsEligible(token: TokenConfig): boolean {
  if (token.symbol === "fALGO") return false;
  return true;
}

/**
 * Easy Savings only surfaces Folks USDC on Pool D (borrow "Pool D USDC" counterpart).
 * Other fUSDC listings (e.g. Pool A ASA) stay out of the curated core list.
 */
export function isFusdcSavingsEligible(
  networkId: NetworkId,
  token: TokenConfig
): boolean {
  return getMarketLabel(networkId, token.poolId) === "D";
}

function isSavingsEligibleListing(
  networkId: NetworkId,
  configKey: string,
  token: TokenConfig
): boolean {
  if (!isDepositable(token)) return false;
  if (!isActiveLendingPool(networkId, token.poolId)) return false;
  if (configKey === "WAD" || token.symbol === "WAD") {
    return isWadSavingsEligible(networkId, token);
  }
  if (configKey === "ALGO") {
    return isAlgoSavingsEligible(token);
  }
  if (configKey === "fUSDC") {
    return isFusdcSavingsEligible(networkId, token);
  }
  return true;
}

const POOL_PRIORITY: Record<string, number> = {
  A: 0,
  B: 1,
  D: 2,
  C: 3,
  E: 4,
  F: 5,
};

const ASSET_UI_ORDER = [
  ...EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS,
  ...EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS,
] as const;

function assetUiRank(configKey: string): number {
  const idx = (ASSET_UI_ORDER as readonly string[]).indexOf(configKey);
  return idx >= 0 ? idx : 1000;
}

/**
 * Deposit routes for Easy Savings (one row per supply market).
 */
export function listSavingsRoutes(
  networkId: NetworkId,
  options?: ListSavingsRoutesOptions
): SavingsRoute[] {
  const keyFilter =
    options?.assetConfigKeys === null
      ? null
      : new Set(options?.assetConfigKeys ?? EASY_SAVINGS_V1_ASSET_CONFIG_KEYS);

  const tokens = getNetworkConfig(networkId).tokens ?? {};
  const routes: SavingsRoute[] = [];

  for (const [configKey, raw] of Object.entries(tokens)) {
    if (keyFilter && !keyFilter.has(configKey)) continue;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const token of rows) {
      if (!isSavingsEligibleListing(networkId, configKey, token)) continue;
      const poolId = String(token.poolId);
      routes.push({
        networkId,
        poolId,
        marketLabel: getLendingPoolLabel(networkId, poolId),
        asset: toMarketRef(configKey, token),
        assetToken: token,
      });
    }
  }

  return routes;
}

export function rankSavingsRoutes(
  routes: SavingsRoute[],
  preferredPoolIds?: readonly string[]
): SavingsRoute[] {
  const preferred = new Set((preferredPoolIds ?? []).map(String));
  return [...routes].sort((a, b) => {
    const aPref = preferred.has(a.poolId) ? 0 : 1;
    const bPref = preferred.has(b.poolId) ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;

    const aLetter = POOL_PRIORITY[a.marketLabel] ?? 99;
    const bLetter = POOL_PRIORITY[b.marketLabel] ?? 99;
    if (aLetter !== bLetter) return aLetter - bLetter;

    const aUi = assetUiRank(a.asset.configKey);
    const bUi = assetUiRank(b.asset.configKey);
    if (aUi !== bUi) return aUi - bUi;

    return a.asset.configKey.localeCompare(b.asset.configKey);
  });
}

function matchesAsset(
  route: SavingsRoute,
  input: ResolveSavingsRouteInput
): boolean {
  if (route.asset.configKey !== input.assetConfigKey) return false;
  if (
    input.assetContractId != null &&
    route.asset.contractId !== String(input.assetContractId)
  ) {
    return false;
  }
  if (
    input.assetPoolId != null &&
    route.asset.poolId !== String(input.assetPoolId)
  ) {
    return false;
  }
  return true;
}

export function resolveSavingsRoutes(
  input: ResolveSavingsRouteInput
): SavingsRoute[] {
  const matched = listSavingsRoutes(input.networkId).filter((route) =>
    matchesAsset(route, input)
  );
  return rankSavingsRoutes(matched, input.preferredPoolIds);
}

export function resolveSavingsRoute(
  input: ResolveSavingsRouteInput
): SavingsRoute | null {
  return resolveSavingsRoutes(input)[0] ?? null;
}

export function listSavingsAssetConfigKeys(
  networkId: NetworkId,
  options?: ListSavingsRoutesOptions
): string[] {
  const keys = new Set<string>();
  for (const route of listSavingsRoutes(networkId, options)) {
    keys.add(route.asset.configKey);
  }
  return [...keys].sort((a, b) => {
    const aUi = assetUiRank(a);
    const bUi = assetUiRank(b);
    if (aUi !== bUi) return aUi - bUi;
    return a.localeCompare(b);
  });
}

export function listCoreSavingsAssetConfigKeys(networkId: NetworkId): string[] {
  return listSavingsAssetConfigKeys(networkId, {
    assetConfigKeys: EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS,
  });
}

export function listHighYieldSavingsAssetConfigKeys(
  networkId: NetworkId
): string[] {
  return listSavingsAssetConfigKeys(networkId, {
    assetConfigKeys: EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS,
  });
}
