/**
 * Easy Borrow market routing: maps collateral + borrow asset selections onto
 * existing DorkFi pool market rows. Does not invent pairs — only same-pool
 * listings from {@link getNetworkConfig}.tokens, plus curated LP→WAD helpers.
 */
import {
  getLendingPoolLabel,
  getMarketLabel,
  getNetworkConfig,
  getUnitLendingCollateralContractIds,
  getUsdcLpLendingCollateralContractIds,
  getWadLpLendingCollateralContractIds,
  type NetworkId,
  type TokenConfig,
} from "@/config";
import type {
  BorrowRoute,
  BorrowTransactionMechanism,
  EasyBorrowMarketRef,
  ResolveBorrowRouteInput,
} from "@/types/easyBorrow";

/**
 * Easy Borrow v1 only exposes these borrow assets in the UI.
 * Full same-pool graph remains available via {@link listBorrowRoutes} with
 * `borrowConfigKeys: null`.
 */
export const EASY_BORROW_V1_BORROW_CONFIG_KEYS = ["WAD", "USDC"] as const;

export type EasyBorrowV1BorrowConfigKey =
  (typeof EASY_BORROW_V1_BORROW_CONFIG_KEYS)[number];

export function isEasyBorrowV1BorrowConfigKey(
  key: string
): key is EasyBorrowV1BorrowConfigKey {
  return (EASY_BORROW_V1_BORROW_CONFIG_KEYS as readonly string[]).includes(key);
}

/**
 * Pool D Folks USDC markets live under config key `fUSDC` but are presented as USDC
 * in Easy Borrow (same-pool pairs with Algo and WAD on D).
 */
export function isEasyBorrowUsdcEquivalentConfigKey(
  networkId: NetworkId,
  configKey: string,
  poolId: string | undefined
): boolean {
  if (configKey === "USDC") return true;
  if (configKey !== "fUSDC" || !poolId) return false;
  return getMarketLabel(networkId, poolId) === "D";
}

/** Collapse Folks/USDC proxy keys so the UI exposes a single "USDC" option. */
export function easyBorrowUiConfigKey(
  networkId: NetworkId,
  configKey: string,
  poolId: string | undefined
): string {
  if (isEasyBorrowUsdcEquivalentConfigKey(networkId, configKey, poolId)) {
    return "USDC";
  }
  return configKey;
}

function matchesConfigKeySelection(
  networkId: NetworkId,
  routeConfigKey: string,
  routePoolId: string,
  selectedConfigKey: string
): boolean {
  if (routeConfigKey === selectedConfigKey) return true;
  if (selectedConfigKey === "USDC") {
    return isEasyBorrowUsdcEquivalentConfigKey(
      networkId,
      routeConfigKey,
      routePoolId
    );
  }
  return false;
}

function isAllowedBorrowConfigKey(
  networkId: NetworkId,
  configKey: string,
  poolId: string,
  filter: Set<string> | null
): boolean {
  if (!filter) return true;
  if (filter.has(configKey)) return true;
  if (
    filter.has("USDC") &&
    isEasyBorrowUsdcEquivalentConfigKey(networkId, configKey, poolId)
  ) {
    return true;
  }
  return false;
}

export type ListBorrowRoutesOptions = {
  /**
   * When set, only emit routes whose borrow config key is in this list.
   * Defaults to {@link EASY_BORROW_V1_BORROW_CONFIG_KEYS}.
   * Pass `null` to include every same-pool borrow asset.
   */
  borrowConfigKeys?: readonly string[] | null;
};

export type MarketListing = {
  configKey: string;
  token: TokenConfig;
};

function toMarketRef(configKey: string, token: TokenConfig): EasyBorrowMarketRef {
  return {
    configKey,
    poolId: String(token.poolId),
    contractId: String(token.contractId),
    nTokenId: String(token.nTokenId),
    symbol: token.marketOverride?.displaySymbol ?? token.symbol,
    decimals: token.decimals,
    tokenStandard: token.tokenStandard,
    logoPath: token.logoPath,
    isStoken: Boolean(token.isStoken),
  };
}

function mechanismForBorrow(token: TokenConfig): BorrowTransactionMechanism {
  return token.isStoken ? "wad_mint_via_borrow" : "pool_borrow";
}

function listingKey(listing: MarketListing): string {
  return `${listing.configKey}:${listing.token.poolId}:${listing.token.contractId}`;
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

/** Curated LP collateral contract ids that intentionally route to WAD on C/E/F. */
export function getExplicitLpWadCollateralContractIds(
  networkId: NetworkId
): Set<string> {
  return new Set([
    ...getUnitLendingCollateralContractIds(networkId),
    ...getWadLpLendingCollateralContractIds(networkId),
    ...getUsdcLpLendingCollateralContractIds(networkId),
  ]);
}

/**
 * Flatten network token config into one listing per market row on an active
 * lending pool (A–F). Skips migration-only / unlabeled pool ids.
 */
export function listActiveMarketListings(
  networkId: NetworkId
): MarketListing[] {
  const tokens = getNetworkConfig(networkId).tokens ?? {};
  const out: MarketListing[] = [];
  for (const [configKey, raw] of Object.entries(tokens)) {
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const token of rows) {
      if (!isDepositable(token)) continue;
      if (!isActiveLendingPool(networkId, token.poolId)) continue;
      out.push({ configKey, token });
    }
  }
  return out;
}

function isExplicitLpWadRoute(
  networkId: NetworkId,
  collateral: MarketListing,
  borrow: MarketListing
): boolean {
  if (borrow.configKey !== "WAD" && borrow.token.symbol !== "WAD") return false;
  const lpIds = getExplicitLpWadCollateralContractIds(networkId);
  return lpIds.has(String(collateral.token.contractId));
}

/**
 * All valid same-pool collateral → borrow routes for Easy Borrow.
 * A route exists when both assets are listed in the same lending pool with
 * distinct market contracts (cross-collateral within that pool).
 *
 * Default: v1 borrow set (WAD + USDC only). Pass `borrowConfigKeys: null` for
 * the full cross-collateral graph.
 *
 * Pool D Folks USDC (`fUSDC`) is included whenever USDC is in the borrow filter.
 */
export function listBorrowRoutes(
  networkId: NetworkId,
  options?: ListBorrowRoutesOptions
): BorrowRoute[] {
  const borrowKeyFilter =
    options?.borrowConfigKeys === null
      ? null
      : new Set(
          options?.borrowConfigKeys ?? EASY_BORROW_V1_BORROW_CONFIG_KEYS
        );

  const listings = listActiveMarketListings(networkId);
  const byPool = new Map<string, MarketListing[]>();
  for (const listing of listings) {
    const poolId = String(listing.token.poolId);
    const bucket = byPool.get(poolId) ?? [];
    bucket.push(listing);
    byPool.set(poolId, bucket);
  }

  const routes: BorrowRoute[] = [];
  for (const [poolId, poolListings] of byPool) {
    const marketLabel = getLendingPoolLabel(networkId, poolId);
    for (const collateral of poolListings) {
      for (const borrow of poolListings) {
        if (
          !isAllowedBorrowConfigKey(
            networkId,
            borrow.configKey,
            poolId,
            borrowKeyFilter
          )
        ) {
          continue;
        }
        if (
          String(collateral.token.contractId) ===
            String(borrow.token.contractId) &&
          collateral.configKey === borrow.configKey
        ) {
          continue;
        }
        // Same market row (identical pool+contract) cannot be both legs.
        if (
          String(collateral.token.contractId) ===
            String(borrow.token.contractId) &&
          String(collateral.token.nTokenId) === String(borrow.token.nTokenId)
        ) {
          continue;
        }

        routes.push({
          networkId,
          poolId,
          marketLabel,
          collateral: toMarketRef(collateral.configKey, collateral.token),
          borrow: toMarketRef(borrow.configKey, borrow.token),
          mechanism: mechanismForBorrow(borrow.token),
          isExplicitLpWadRoute: isExplicitLpWadRoute(
            networkId,
            collateral,
            borrow
          ),
          collateralToken: collateral.token,
          borrowToken: borrow.token,
        });
      }
    }
  }

  return routes;
}

function matchesCollateral(
  route: BorrowRoute,
  input: ResolveBorrowRouteInput
): boolean {
  if (
    !matchesConfigKeySelection(
      route.networkId,
      route.collateral.configKey,
      route.collateral.poolId,
      input.collateralConfigKey
    )
  ) {
    return false;
  }
  if (
    input.collateralContractId != null &&
    route.collateral.contractId !== String(input.collateralContractId)
  ) {
    return false;
  }
  if (
    input.collateralPoolId != null &&
    route.collateral.poolId !== String(input.collateralPoolId)
  ) {
    return false;
  }
  return true;
}

function matchesBorrow(
  route: BorrowRoute,
  input: ResolveBorrowRouteInput
): boolean {
  if (
    !matchesConfigKeySelection(
      route.networkId,
      route.borrow.configKey,
      route.borrow.poolId,
      input.borrowConfigKey
    )
  ) {
    return false;
  }
  if (
    input.borrowContractId != null &&
    route.borrow.contractId !== String(input.borrowContractId)
  ) {
    return false;
  }
  if (
    input.borrowPoolId != null &&
    route.borrow.poolId !== String(input.borrowPoolId)
  ) {
    return false;
  }
  return true;
}

/** Pool letter sort: A before B before D before C/E/F (prime markets first). */
const POOL_PRIORITY: Record<string, number> = {
  A: 0,
  B: 1,
  D: 2,
  C: 3,
  E: 4,
  F: 5,
};

/**
 * Rank routes for a collateral/borrow pair.
 * Prefer: preferred pools → explicit LP→WAD → prime market letter → stoken WAD mint.
 */
export function rankBorrowRoutes(
  routes: BorrowRoute[],
  preferredPoolIds?: readonly string[]
): BorrowRoute[] {
  const preferred = new Set((preferredPoolIds ?? []).map(String));
  return [...routes].sort((a, b) => {
    const aPref = preferred.has(a.poolId) ? 0 : 1;
    const bPref = preferred.has(b.poolId) ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;

    const aLp = a.isExplicitLpWadRoute ? 0 : 1;
    const bLp = b.isExplicitLpWadRoute ? 0 : 1;
    if (aLp !== bLp) return aLp - bLp;

    const aLetter = POOL_PRIORITY[a.marketLabel] ?? 99;
    const bLetter = POOL_PRIORITY[b.marketLabel] ?? 99;
    if (aLetter !== bLetter) return aLetter - bLetter;

    const aMint = a.mechanism === "wad_mint_via_borrow" ? 0 : 1;
    const bMint = b.mechanism === "wad_mint_via_borrow" ? 0 : 1;
    if (aMint !== bMint) return aMint - bMint;

    return listingKey({
      configKey: a.collateral.configKey,
      token: a.collateralToken,
    }).localeCompare(
      listingKey({
        configKey: b.collateral.configKey,
        token: b.collateralToken,
      })
    );
  });
}

/** All routes matching a collateral + borrow selection (may be multi-pool). */
export function resolveBorrowRoutes(
  input: ResolveBorrowRouteInput
): BorrowRoute[] {
  const all = listBorrowRoutes(input.networkId);
  const matched = all.filter(
    (route) => matchesCollateral(route, input) && matchesBorrow(route, input)
  );
  return rankBorrowRoutes(matched, input.preferredPoolIds);
}

/**
 * Resolve the default DorkFi market for a collateral → borrow pair.
 * Returns null when no same-pool route exists.
 */
export function resolveBorrowRoute(
  input: ResolveBorrowRouteInput
): BorrowRoute | null {
  const ranked = resolveBorrowRoutes(input);
  return ranked[0] ?? null;
}

/** Distinct collateral config keys that participate in at least one borrow route. */
export function listCollateralConfigKeys(networkId: NetworkId): string[] {
  const keys = new Set<string>();
  for (const route of listBorrowRoutes(networkId)) {
    keys.add(
      easyBorrowUiConfigKey(
        networkId,
        route.collateral.configKey,
        route.collateral.poolId
      )
    );
  }
  return [...keys].sort();
}

/** Synthetic UI key for Pool D Folks USDC (own row in the borrow dropdown). */
export const EASY_BORROW_POOL_D_USDC_UI_KEY = "USDC_D";

export type EasyBorrowAssetOption = {
  /** Stable id used by AssetSelector. */
  uiKey: string;
  symbol: string;
  subtitle: string;
  logoPath?: string;
  /** Passed to {@link resolveBorrowRoute} as `borrowConfigKey`. */
  borrowConfigKey: string;
  preferredPoolIds?: readonly string[];
};

/**
 * Borrow dropdown rows for a collateral selection.
 * Pool D Folks USDC is listed separately as {@link EASY_BORROW_POOL_D_USDC_UI_KEY}
 * so users can pin market D instead of default A/B USDC.
 */
export function listBorrowAssetOptionsForCollateral(
  networkId: NetworkId,
  collateralConfigKey: string,
  opts?: {
    collateralContractId?: string;
    collateralPoolId?: string;
    preferredPoolIds?: readonly string[];
  }
): EasyBorrowAssetOption[] {
  const routes = rankBorrowRoutes(
    listBorrowRoutes(networkId).filter((route) =>
      matchesCollateral(route, {
        networkId,
        collateralConfigKey,
        borrowConfigKey: route.borrow.configKey,
        collateralContractId: opts?.collateralContractId,
        collateralPoolId: opts?.collateralPoolId,
      })
    ),
    opts?.preferredPoolIds
  );

  let wad: EasyBorrowAssetOption | null = null;
  let usdc: EasyBorrowAssetOption | null = null;
  let usdcD: EasyBorrowAssetOption | null = null;

  for (const route of routes) {
    if (route.borrow.configKey === "WAD" || route.borrow.symbol === "WAD") {
      if (!wad) {
        wad = {
          uiKey: "WAD",
          symbol: "WAD",
          subtitle: "Stablecoin debt",
          logoPath: route.borrow.logoPath,
          borrowConfigKey: "WAD",
        };
      }
      continue;
    }

    const isPoolDUsdc =
      route.marketLabel === "D" &&
      isEasyBorrowUsdcEquivalentConfigKey(
        networkId,
        route.borrow.configKey,
        route.borrow.poolId
      );

    if (isPoolDUsdc) {
      if (!usdcD) {
        usdcD = {
          uiKey: EASY_BORROW_POOL_D_USDC_UI_KEY,
          symbol: "Pool D USDC",
          subtitle: "Folks USDC market",
          logoPath: route.borrow.logoPath || "/lovable-uploads/USDC.webp",
          borrowConfigKey: "USDC",
          preferredPoolIds: [route.poolId],
        };
      }
      continue;
    }

    if (
      isEasyBorrowUsdcEquivalentConfigKey(
        networkId,
        route.borrow.configKey,
        route.borrow.poolId
      ) ||
      route.borrow.configKey === "USDC"
    ) {
      if (!usdc) {
        usdc = {
          uiKey: "USDC",
          symbol: "USDC",
          subtitle: "USD Coin",
          logoPath: route.borrow.logoPath || "/lovable-uploads/USDC.webp",
          borrowConfigKey: "USDC",
        };
      }
    }
  }

  return [wad, usdc, usdcD].filter(
    (o): o is EasyBorrowAssetOption => o != null
  );
}

/** Borrow config keys reachable from a given collateral selection. */
export function listBorrowConfigKeysForCollateral(
  networkId: NetworkId,
  collateralConfigKey: string,
  opts?: {
    collateralContractId?: string;
    collateralPoolId?: string;
    preferredPoolIds?: readonly string[];
  }
): string[] {
  return listBorrowAssetOptionsForCollateral(
    networkId,
    collateralConfigKey,
    opts
  ).map((o) => o.uiKey);
}

/** Unique collateral market refs (for asset selector rows). */
export function listCollateralMarketRefs(
  networkId: NetworkId
): EasyBorrowMarketRef[] {
  const seen = new Set<string>();
  const out: EasyBorrowMarketRef[] = [];
  for (const route of listBorrowRoutes(networkId)) {
    const key = `${route.collateral.configKey}:${route.collateral.poolId}:${route.collateral.contractId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(route.collateral);
  }
  return out;
}
