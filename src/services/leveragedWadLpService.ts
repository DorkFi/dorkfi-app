/**
 * Leveraged WAD/USDC Higher Yield:
 * USDC-first deploy with 75/25 split.
 *
 *   75% → supply USDC as DorkFi collateral (safe)
 *   25% → pair on Tinyman with minted WAD
 *   Then supply LP into LP_TMPOOL2_WAD_USDC (Higher Yield)
 */
import algosdk from "algosdk";
import BigNumber from "bignumber.js";
import {
  getAlgorandNetworkFromNetworkId,
  getAllTokens,
  type NetworkId,
  type TokenConfig,
} from "@/config";
import {
  CURATED_LIQUIDITY_POOLS,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";
import {
  buildFlexibleAddLiquidityTransactions,
  fetchAlgorandAssetBalance,
  fetchLiquidityPoolSnapshot,
  formatLiquidityAtomic,
} from "@/services/tinymanLiquidityService";
import {
  borrow,
  deposit,
  fetchMarketInfo,
  fetchUserGlobalDataForPool,
  fetchUserWalletBalance,
  type MarketInfo,
} from "@/services/lendingService";
import algorandService from "@/services/algorandService";
import { resolveSavingsRoute } from "@/services/savingsRouteResolver";
import type { SavingsRoute } from "@/types/easySavings";
import { usdPerTokenFromMarketInfoPrice } from "@/utils/assetDecimals";
import {
  availableBorrowLiquidityTokens,
  effectiveAvailableBorrowTokens,
  estimatePoolHealthAfterSupplyAndBorrow,
  floorTokenAmount,
  safeMaxBorrowTokens,
} from "@/utils/easyBorrowMath";
import { normalizeLiquidationThresholdToDecimal } from "@/utils/userHealth";
import { buildLiquidationThresholdSummaryForDeposit } from "@/utils/depositModalPoolHealthEstimate";

export const LEVERAGED_WAD_USDC_SAVINGS_KEY = "LP_TMPOOL2_WAD_USDC";
/** Share of total USDC kept as safe collateral supply. */
export const SAFE_COLLATERAL_USDC_SHARE = 0.75;
/** Share of total USDC used as Tinyman LP USDC leg. */
export const PAIR_USDC_SHARE = 0.25;
/** Max LTV safety on collateral USD after the USDC supply. */
export const LEVERAGED_WAD_LP_SAFETY_LTV = 0.7;

export function getWadUsdcLiquidityPair(
  networkId: NetworkId
): LiquidityPoolPairConfig | null {
  return (
    CURATED_LIQUIDITY_POOLS.find(
      (p) => p.id === "wad-usdc" && p.networkId === networkId
    ) ?? null
  );
}

export function isLeveragedWadUsdcRoute(configKey: string | undefined): boolean {
  return configKey === LEVERAGED_WAD_USDC_SAVINGS_KEY;
}

export type UsdcDeploySplit = {
  totalUsdc: number;
  safeCollateralUsdc: number;
  pairUsdc: number;
  wadToMint: number;
};

/** Derive 75/25 split + WAD mint size from pool ratio. */
export function sizeUsdcDeploySplit(
  totalUsdc: number,
  usdcPerWad: number | null
): UsdcDeploySplit | null {
  if (!(totalUsdc > 0) || !Number.isFinite(totalUsdc)) return null;
  const safeCollateralUsdc = floorTokenAmount(
    totalUsdc * SAFE_COLLATERAL_USDC_SHARE,
    6
  );
  const pairUsdc = floorTokenAmount(totalUsdc * PAIR_USDC_SHARE, 6);
  if (!(safeCollateralUsdc > 0) || !(pairUsdc > 0)) return null;
  const r = usdcPerWad != null && usdcPerWad > 0 ? usdcPerWad : 1;
  const wadToMint = floorTokenAmount(pairUsdc / r, 6);
  if (!(wadToMint > 0)) return null;
  return { totalUsdc, safeCollateralUsdc, pairUsdc, wadToMint };
}

function base64ToTxn(b64: string): algosdk.Transaction {
  return algosdk.decodeUnsignedTransaction(
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  );
}

function txnsToWalletBytes(txns: algosdk.Transaction[]): Uint8Array[] {
  for (const t of txns) {
    t.group = undefined;
  }
  const grouped = algosdk.assignGroupID(txns);
  return grouped.map((t) =>
    Uint8Array.from(algosdk.encodeUnsignedTransaction(t))
  );
}

function listWadBorrowMarkets(networkId: NetworkId): TokenConfig[] {
  const tokens = getAllTokens(networkId);
  const out: TokenConfig[] = [];
  for (const t of tokens) {
    if (t.symbol !== "WAD" || !t.poolId || !t.contractId) continue;
    out.push(t);
  }
  const seen = new Set<string>();
  return out.filter((t) => {
    const k = `${t.poolId}:${t.contractId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Default Pool A USDC savings route for safe collateral leg. */
export function resolveUsdcCollateralRoute(
  networkId: NetworkId
): SavingsRoute | null {
  return resolveSavingsRoute({
    networkId,
    assetConfigKey: "USDC",
  });
}

export type WadBorrowContext = {
  poolId: string;
  marketId: string;
  token: TokenConfig;
  tokenStandard: TokenConfig["tokenStandard"];
  decimals: number;
  market: MarketInfo;
  global: {
    totalCollateralValue: number;
    totalBorrowValue: number;
  };
  /** Safe WAD max after optional additional collateral USD is assumed. */
  maxBorrowHuman: number;
  healthBefore: number | null;
};

/**
 * WAD borrow capacity on a pool, optionally after adding collateral USD (the 75% USDC leg).
 */
export async function resolveWadBorrowContext(params: {
  networkId: NetworkId;
  userAddress: string;
  preferredPoolId?: string;
  additionalCollateralUsd?: number;
}): Promise<WadBorrowContext | null> {
  const {
    networkId,
    userAddress,
    preferredPoolId,
    additionalCollateralUsd = 0,
  } = params;
  const markets = listWadBorrowMarkets(networkId);
  let best: WadBorrowContext | null = null;

  const ordered = preferredPoolId
    ? [
        ...markets.filter((t) => String(t.poolId) === String(preferredPoolId)),
        ...markets.filter((t) => String(t.poolId) !== String(preferredPoolId)),
      ]
    : markets;

  for (const token of ordered) {
    const poolId = String(token.poolId);
    const marketId = String(token.contractId);
    try {
      const [market, global] = await Promise.all([
        fetchMarketInfo(poolId, marketId, networkId),
        fetchUserGlobalDataForPool(userAddress, networkId, poolId),
      ]);
      if (!market) continue;

      const existingGlobal = {
        totalCollateralValue: Number(global?.totalCollateralValue) || 0,
        totalBorrowValue: Number(global?.totalBorrowValue) || 0,
      };

      // Project collateral after safe USDC supply (only on preferred/same pool).
      const addUsd =
        preferredPoolId == null || poolId === String(preferredPoolId)
          ? Math.max(0, additionalCollateralUsd)
          : 0;

      const poolGlobal = {
        totalCollateralValue:
          existingGlobal.totalCollateralValue + addUsd,
        totalBorrowValue: existingGlobal.totalBorrowValue,
      };

      if (poolGlobal.totalCollateralValue <= 0) continue;

      const price = usdPerTokenFromMarketInfoPrice(
        market.price,
        token.decimals
      );
      if (!Number.isFinite(price) || price <= 0) continue;

      const cf = Number(market.collateralFactor ?? 0);
      const ltRaw = market.liquidationThreshold ?? 0;
      const ltPercent = normalizeLiquidationThresholdToDecimal(ltRaw) * 100;

      const liqSummary = buildLiquidationThresholdSummaryForDeposit(
        ltPercent,
        undefined,
        undefined
      );

      const totalDeposits = parseFloat(market.totalDeposits) || 0;
      const totalBorrows = parseFloat(market.totalBorrows) || 0;
      const borrowCap = parseFloat(market.maxTotalBorrows);
      const liqAvailable = availableBorrowLiquidityTokens({
        totalDeposits,
        totalBorrows,
        borrowCap: Number.isFinite(borrowCap) ? borrowCap : null,
      });

      const hfSafe = safeMaxBorrowTokens({
        poolGlobal,
        additionalCollateralUsd: 0, // already folded into poolGlobal
        liquidationThresholdPercent: ltPercent,
        borrowTokenPrice: price,
        borrowDecimals: token.decimals,
      });

      const ltvCap = Math.min(
        Number.isFinite(cf) && cf > 0 ? cf : LEVERAGED_WAD_LP_SAFETY_LTV,
        LEVERAGED_WAD_LP_SAFETY_LTV
      );
      const cfRoomUsd =
        poolGlobal.totalCollateralValue * ltvCap - poolGlobal.totalBorrowValue;
      const ltvCapHuman = Math.max(0, cfRoomUsd / price);

      const available = Math.min(
        ltvCapHuman,
        effectiveAvailableBorrowTokens({
          safeMax: hfSafe,
          chainMax: null,
          liquidity: liqAvailable,
        })
      );

      if (!(available > 0)) continue;

      const health = estimatePoolHealthAfterSupplyAndBorrow(
        existingGlobal,
        liqSummary,
        addUsd,
        0
      );

      const candidate: WadBorrowContext = {
        poolId,
        marketId,
        token,
        tokenStandard: token.tokenStandard,
        decimals: token.decimals,
        market,
        global: existingGlobal,
        maxBorrowHuman: floorTokenAmount(available, token.decimals),
        healthBefore: health?.beforeValue ?? health?.value ?? null,
      };

      // Prefer same pool when preferredPoolId is set
      if (preferredPoolId && poolId === String(preferredPoolId)) {
        return candidate;
      }

      if (!best || candidate.maxBorrowHuman > best.maxBorrowHuman) {
        best = candidate;
      }
    } catch {
      // skip
    }
  }

  return best;
}

export type LeveragedWadLpQuoteSnapshot = {
  pair: LiquidityPoolPairConfig | null;
  usdcCollateralRoute: SavingsRoute | null;
  borrow: WadBorrowContext | null;
  usdcBalance: number | null;
  algoBalance: number | null;
  usdcPerWad: number | null;
  split: UsdcDeploySplit | null;
  estimatedLpTokens: number | null;
  healthAfter: number | null;
  /** Max WAD after 75% USDC is supplied as collateral. */
  maxWadAfterCollateral: number | null;
  lpSupplyApyPercent: number | null;
  error: string | null;
};

export async function quoteLeveragedWadLp(params: {
  networkId: NetworkId;
  userAddress: string | undefined;
  /** Total USDC user deposits (75% safe + 25% pair). */
  totalUsdc: number;
  lpMarketInfo?: MarketInfo | null;
}): Promise<LeveragedWadLpQuoteSnapshot> {
  const { networkId, userAddress, totalUsdc, lpMarketInfo } = params;
  const pair = getWadUsdcLiquidityPair(networkId);
  const usdcCollateralRoute = resolveUsdcCollateralRoute(networkId);

  const empty = (
    error: string | null,
    extra?: Partial<LeveragedWadLpQuoteSnapshot>
  ): LeveragedWadLpQuoteSnapshot => ({
    pair,
    usdcCollateralRoute,
    borrow: null,
    usdcBalance: null,
    algoBalance: null,
    usdcPerWad: null,
    split: null,
    estimatedLpTokens: null,
    healthAfter: null,
    maxWadAfterCollateral: null,
    lpSupplyApyPercent: null,
    error,
    ...extra,
  });

  if (!pair) {
    return empty("WAD/USDC pool is only available on Algorand mainnet.");
  }
  if (!usdcCollateralRoute) {
    return empty("Could not resolve a USDC collateral market.");
  }

  const snapshot = await fetchLiquidityPoolSnapshot(pair);
  if (!snapshot) {
    return empty("Could not load Tinyman WAD/USDC pool.");
  }

  const wadReserve = Number(snapshot.asset1ReserveHuman);
  const usdcReserve = Number(snapshot.asset2ReserveHuman);
  const usdcPerWad =
    wadReserve > 0 && Number.isFinite(wadReserve) && Number.isFinite(usdcReserve)
      ? usdcReserve / wadReserve
      : 1;

  const split =
    totalUsdc > 0 ? sizeUsdcDeploySplit(totalUsdc, usdcPerWad) : null;

  const issuedLp = Number(
    new BigNumber(snapshot.totalLiquidity.toString()).shiftedBy(-6).toFixed(6)
  );
  const estimatedLpTokens =
    split && wadReserve > 0
      ? floorTokenAmount(
          issuedLp * (split.wadToMint / (wadReserve + split.wadToMint)),
          6
        )
      : null;

  let usdcBalance: number | null = null;
  let algoBalance: number | null = null;
  let borrow: WadBorrowContext | null = null;
  let error: string | null = null;

  if (userAddress) {
    try {
      usdcBalance = await fetchUserWalletBalance(
        userAddress,
        "USDC",
        networkId
      );
    } catch {
      usdcBalance = null;
    }

    try {
      const algodNetwork = getAlgorandNetworkFromNetworkId(networkId);
      if (algodNetwork) {
        const { algod } =
          await algorandService.initializeClientsForReads(algodNetwork);
        const info = await algod.accountInformation(userAddress).do();
        const amountRaw = (info as { amount?: bigint | number }).amount ?? 0;
        const minRaw =
          (info as { minBalance?: bigint | number; "min-balance"?: number })
            .minBalance ??
          (info as { "min-balance"?: number })["min-balance"] ??
          0;
        const micro =
          typeof amountRaw === "bigint" ? amountRaw : BigInt(amountRaw);
        const min = typeof minRaw === "bigint" ? minRaw : BigInt(minRaw);
        algoBalance = Number(micro - min) / 1e6;
      }
    } catch {
      algoBalance = null;
    }

    const usdcPrice = 1; // USDC ≈ $1 for sizing
    const additionalCollateralUsd = split
      ? split.safeCollateralUsdc * usdcPrice
      : 0;

    try {
      borrow = await resolveWadBorrowContext({
        networkId,
        userAddress,
        preferredPoolId: usdcCollateralRoute.poolId,
        additionalCollateralUsd,
      });
    } catch (e) {
      error =
        e instanceof Error ? e.message : "Failed to resolve WAD mint capacity.";
    }
  }

  let healthAfter: number | null = null;
  if (borrow && split) {
    const price = usdPerTokenFromMarketInfoPrice(
      borrow.market.price,
      borrow.decimals
    );
    const ltPercent =
      normalizeLiquidationThresholdToDecimal(
        borrow.market.liquidationThreshold ?? 0
      ) * 100;
    const liqSummary = buildLiquidationThresholdSummaryForDeposit(
      ltPercent,
      undefined,
      undefined
    );
    const health = estimatePoolHealthAfterSupplyAndBorrow(
      borrow.global,
      liqSummary,
      split.safeCollateralUsdc,
      split.wadToMint * price
    );
    healthAfter = health?.value ?? null;
  }

  if (split && borrow && split.wadToMint > borrow.maxBorrowHuman + 1e-9) {
    error =
      error ??
      `Mint needs ${split.wadToMint.toFixed(4)} WAD; safe max after collateral is ${borrow.maxBorrowHuman.toFixed(4)} WAD. Lower USDC amount.`;
  }

  const lpSupplyApyPercent =
    lpMarketInfo?.apyCalculation?.apy != null &&
    Number.isFinite(lpMarketInfo.apyCalculation.apy)
      ? lpMarketInfo.apyCalculation.apy
      : lpMarketInfo?.supplyRate != null
        ? lpMarketInfo.supplyRate * 100
        : null;

  return {
    pair,
    usdcCollateralRoute,
    borrow,
    usdcBalance,
    algoBalance,
    usdcPerWad,
    split,
    estimatedLpTokens,
    healthAfter,
    maxWadAfterCollateral: borrow?.maxBorrowHuman ?? null,
    lpSupplyApyPercent,
    error,
  };
}

async function depositUsdcCollateral(params: {
  networkId: NetworkId;
  userAddress: string;
  route: SavingsRoute;
  usdcHuman: number;
}): Promise<{ unsignedBytes: Uint8Array[] }> {
  const { networkId, userAddress, route, usdcHuman } = params;
  const amountAtomic = new BigNumber(usdcHuman)
    .times(10 ** route.asset.decimals)
    .integerValue(BigNumber.ROUND_DOWN)
    .toFixed(0);
  if (amountAtomic === "0") throw new Error("Collateral USDC amount too small.");

  const result = await deposit(
    route.poolId,
    route.asset.contractId,
    route.asset.tokenStandard,
    amountAtomic,
    userAddress,
    networkId
  );
  if (!result.success || !("txns" in result) || !result.txns?.length) {
    throw new Error(
      "error" in result && result.error
        ? String(result.error)
        : "Failed to build USDC collateral deposit."
    );
  }
  return {
    unsignedBytes: result.txns.map((txn) =>
      Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
    ),
  };
}

/**
 * After 75% USDC collateral confirms: mint WAD + Tinyman flex add-liquidity (25% USDC).
 */
export async function prepareMintAndPairAfterCollateral(params: {
  networkId: NetworkId;
  userAddress: string;
  split: UsdcDeploySplit;
  preferredPoolId: string;
}): Promise<{
  unsignedBytes: Uint8Array[];
  estimatedLpTokens: number;
  lpTokenId: number;
  borrowPoolId: string;
  borrowMarketId: string;
}> {
  const { networkId, userAddress, split, preferredPoolId } = params;
  const pair = getWadUsdcLiquidityPair(networkId);
  if (!pair) throw new Error("WAD/USDC pool unavailable.");

  // Collateral is live; compute room without projected add
  const borrowCtx = await resolveWadBorrowContext({
    networkId,
    userAddress,
    preferredPoolId,
    additionalCollateralUsd: 0,
  });
  if (!borrowCtx) {
    throw new Error(
      "No WAD mint capacity after collateral supply. Check health factor."
    );
  }
  if (split.wadToMint > borrowCtx.maxBorrowHuman + 1e-9) {
    throw new Error(
      `WAD mint ${split.wadToMint.toFixed(4)} exceeds safe max ${borrowCtx.maxBorrowHuman.toFixed(4)}.`
    );
  }

  const wadAtomic = new BigNumber(split.wadToMint)
    .times(10 ** borrowCtx.decimals)
    .integerValue(BigNumber.ROUND_DOWN)
    .toFixed(0);

  const borrowResult = await borrow(
    borrowCtx.poolId,
    borrowCtx.marketId,
    borrowCtx.tokenStandard,
    wadAtomic,
    userAddress,
    networkId
  );
  if (
    !borrowResult.success ||
    !("txns" in borrowResult) ||
    !borrowResult.txns?.length
  ) {
    throw new Error(
      "error" in borrowResult && borrowResult.error
        ? String(borrowResult.error)
        : "Failed to build WAD mint."
    );
  }

  const { txGroup, poolTokenOutAtomic, poolTokenId } =
    await buildFlexibleAddLiquidityTransactions({
      pair,
      userAddress,
      asset1AmountHuman: String(split.wadToMint),
      asset2AmountHuman: String(split.pairUsdc),
      slippage: 0.01,
    });

  const unsignedBytes = txnsToWalletBytes([
    ...borrowResult.txns.map(base64ToTxn),
    ...txGroup.map(({ txn }) => txn),
  ]);

  const estimatedLpTokens = Number(
    new BigNumber(poolTokenOutAtomic.toString()).shiftedBy(-6).toFixed(6)
  );

  return {
    unsignedBytes,
    estimatedLpTokens,
    lpTokenId: poolTokenId,
    borrowPoolId: borrowCtx.poolId,
    borrowMarketId: borrowCtx.marketId,
  };
}

/**
 * B) Supply wallet LP into Higher Yield WAD-USDC market.
 */
export async function prepareLeveragedWadLpSupply(params: {
  networkId: NetworkId;
  userAddress: string;
  lpAmountHuman: number;
  savingsPoolId: string;
  savingsMarketId: string;
  tokenStandard: TokenConfig["tokenStandard"];
  decimals: number;
}): Promise<{ unsignedBytes: Uint8Array[]; lpAmountHuman: number }> {
  const {
    networkId,
    userAddress,
    lpAmountHuman,
    savingsPoolId,
    savingsMarketId,
    tokenStandard,
    decimals,
  } = params;
  if (!(lpAmountHuman > 0)) throw new Error("No LP amount to supply.");

  const amountAtomic = new BigNumber(lpAmountHuman)
    .times(10 ** decimals)
    .integerValue(BigNumber.ROUND_DOWN)
    .toFixed(0);
  if (amountAtomic === "0") throw new Error("LP amount too small.");

  const result = await deposit(
    savingsPoolId,
    savingsMarketId,
    tokenStandard,
    amountAtomic,
    userAddress,
    networkId
  );
  if (!result.success || !("txns" in result) || !result.txns?.length) {
    throw new Error(
      "error" in result && result.error
        ? String(result.error)
        : "Failed to build LP supply transactions."
    );
  }

  return {
    unsignedBytes: result.txns.map((txn) =>
      Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
    ),
    lpAmountHuman,
  };
}

export async function readWalletLpBalanceHuman(
  networkId: NetworkId,
  userAddress: string,
  lpTokenId: number
): Promise<number> {
  const atomic = await fetchAlgorandAssetBalance(
    networkId,
    userAddress,
    lpTokenId
  );
  return Number(formatLiquidityAtomic(atomic, 6));
}

/** Prepare only the 75% USDC collateral deposit. */
export async function prepareUsdcCollateralDeposit(params: {
  networkId: NetworkId;
  userAddress: string;
  totalUsdcHuman: number;
}): Promise<{
  unsignedBytes: Uint8Array[];
  split: UsdcDeploySplit;
  preferredPoolId: string;
  estimatedLpTokens: number;
  lpTokenId: number;
}> {
  const { networkId, userAddress, totalUsdcHuman } = params;
  const quote = await quoteLeveragedWadLp({
    networkId,
    userAddress,
    totalUsdc: totalUsdcHuman,
  });
  if (!quote.split || !quote.usdcCollateralRoute || !quote.pair) {
    throw new Error(quote.error ?? "Could not size USDC deploy.");
  }
  if (
    quote.usdcBalance != null &&
    totalUsdcHuman > quote.usdcBalance + 1e-9
  ) {
    throw new Error(
      `Insufficient USDC: need ${totalUsdcHuman.toFixed(2)}, have ${quote.usdcBalance.toFixed(2)}.`
    );
  }
  if (quote.error) throw new Error(quote.error);

  const borrowProbe = await resolveWadBorrowContext({
    networkId,
    userAddress,
    preferredPoolId: quote.usdcCollateralRoute.poolId,
    additionalCollateralUsd: quote.split.safeCollateralUsdc,
  });
  if (!borrowProbe || quote.split.wadToMint > borrowProbe.maxBorrowHuman + 1e-9) {
    throw new Error(
      quote.error ??
        "Not enough safe borrow capacity after collateral. Reduce USDC amount."
    );
  }

  const { unsignedBytes } = await depositUsdcCollateral({
    networkId,
    userAddress,
    route: quote.usdcCollateralRoute,
    usdcHuman: quote.split.safeCollateralUsdc,
  });

  const lpProbe = await buildFlexibleAddLiquidityTransactions({
    pair: quote.pair,
    userAddress,
    asset1AmountHuman: String(quote.split.wadToMint),
    asset2AmountHuman: String(quote.split.pairUsdc),
    slippage: 0.01,
  });

  return {
    unsignedBytes,
    split: quote.split,
    preferredPoolId: quote.usdcCollateralRoute.poolId,
    estimatedLpTokens: Number(
      new BigNumber(lpProbe.poolTokenOutAtomic.toString()).shiftedBy(-6).toFixed(6)
    ),
    lpTokenId: lpProbe.poolTokenId,
  };
}
