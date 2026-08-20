import { useQuery } from "@tanstack/react-query";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { getNetworkConfig, type NetworkId } from "@/config";
import { calculateMaxBorrowAmount } from "@/services/adminService";
import {
  fetchMarketInfo,
  fetchUserDepositBalance,
  fetchUserGlobalDataForPool,
  fetchUserWalletBalance,
  type MarketInfo,
} from "@/services/lendingService";
import type { BorrowRoute } from "@/types/easyBorrow";
import {
  availableBorrowLiquidityTokens,
  effectiveAvailableBorrowTokens,
  estimateLiquidationPrice,
  estimatePoolHealthAfterSupplyAndBorrow,
  floorTokenAmount,
  safeMaxBorrowTokens,
  theoreticalMaxBorrowTokens,
} from "@/utils/easyBorrowMath";
import { buildLiquidationThresholdSummaryForDeposit } from "@/utils/depositModalPoolHealthEstimate";
import { usdPerTokenFromMarketInfoPrice } from "@/utils/assetDecimals";
import { normalizeLiquidationThresholdToDecimal } from "@/utils/userHealth";
import BigNumber from "bignumber.js";

export type CollateralSource = "wallet" | "existing";

export type EasyBorrowQuoteInput = {
  networkId: NetworkId;
  route: BorrowRoute | null;
  collateralAmount: string;
  borrowAmount: string;
  collateralSource: CollateralSource;
};

export type EasyBorrowQuote = {
  collateralPrice: number | null;
  borrowPrice: number | null;
  walletBalance: number | null;
  existingDeposit: number | null;
  poolGlobal: {
    totalCollateralValue: number;
    totalBorrowValue: number;
  } | null;
  collateralMarket: MarketInfo | null;
  borrowMarket: MarketInfo | null;
  collateralFactor: number | null;
  liquidationThreshold: number | null;
  borrowAprPercent: number | null;
  supplyAprPercent: number | null;
  availableLiquidity: number | null;
  theoreticalMax: number | null;
  safeMax: number | null;
  chainMax: number | null;
  availableToBorrow: number;
  collateralUsd: number;
  borrowUsd: number;
  healthBefore: number | null;
  healthAfter: number | null;
  liquidationPrice: number | null;
  supplyCapHuman: number | null;
  borrowCapHuman: number | null;
  isLoading: boolean;
  error: string | null;
};

function marketUsdPrice(
  info: MarketInfo | null,
  decimals: number
): number | null {
  if (!info) return null;
  const usd = usdPerTokenFromMarketInfoPrice(info.price, decimals);
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

function humanFromMarketCap(
  cap: string | undefined,
  _decimals: number
): number | null {
  if (cap == null || cap === "") return null;
  const n = parseFloat(cap);
  return Number.isFinite(n) ? n : null;
}

/**
 * Live quote for the selected Easy Borrow route.
 * Market/oracle/balance fetches are cached; amount changes are local math.
 */
export function useEasyBorrowQuote(
  input: EasyBorrowQuoteInput
): EasyBorrowQuote {
  const { activeAccount } = useDorkFiWalletAdapter();
  const address = activeAccount?.address;
  const route = input.route;
  const networkId = input.networkId;

  const marketQuery = useQuery({
    queryKey: [
      "easyBorrow",
      "markets",
      networkId,
      route?.poolId,
      route?.collateral.contractId,
      route?.borrow.contractId,
    ],
    enabled: Boolean(route),
    staleTime: 60_000,
    queryFn: async () => {
      if (!route) return null;
      const [collateralMarket, borrowMarket] = await Promise.all([
        fetchMarketInfo(route.poolId, route.collateral.contractId, networkId),
        fetchMarketInfo(route.poolId, route.borrow.contractId, networkId),
      ]);
      return { collateralMarket, borrowMarket };
    },
  });

  const balanceQuery = useQuery({
    queryKey: [
      "easyBorrow",
      "wallet",
      networkId,
      address,
      route?.collateral.configKey,
    ],
    enabled: Boolean(route && address),
    staleTime: 30_000,
    queryFn: async () => {
      if (!route || !address) return null;
      return fetchUserWalletBalance(
        address,
        route.collateral.configKey,
        networkId
      );
    },
  });

  const positionQuery = useQuery({
    queryKey: [
      "easyBorrow",
      "position",
      networkId,
      address,
      route?.poolId,
      route?.collateral.contractId,
    ],
    enabled: Boolean(route && address),
    staleTime: 30_000,
    queryFn: async () => {
      if (!route || !address) return null;
      const [poolGlobal, depositData] = await Promise.all([
        fetchUserGlobalDataForPool(address, networkId, route.poolId),
        fetchUserDepositBalance(
          address,
          route.poolId,
          route.collateral.contractId,
          networkId
        ),
      ]);
      return {
        poolGlobal,
        existingDeposit: depositData?.balance ?? null,
      };
    },
  });

  const chainMaxQuery = useQuery({
    queryKey: [
      "easyBorrow",
      "chainMax",
      networkId,
      address,
      route?.poolId,
      route?.borrow.contractId,
      input.collateralSource,
    ],
    enabled: Boolean(route && address),
    staleTime: 30_000,
    queryFn: async () => {
      if (!route || !address) return null;
      const storageAppId =
        getNetworkConfig(networkId)?.contracts?.appStorageId;
      const max = await calculateMaxBorrowAmount(
        route.poolId,
        address,
        route.borrow.contractId,
        storageAppId ? Number(storageAppId) : undefined
      );
      if (max == null) return null;
      const decimals = route.borrow.decimals ?? 6;
      return new BigNumber(max.toString())
        .div(new BigNumber(10).pow(decimals))
        .toNumber();
    },
  });

  const collateralMarket = marketQuery.data?.collateralMarket ?? null;
  const borrowMarket = marketQuery.data?.borrowMarket ?? null;
  const collateralPrice = marketUsdPrice(
    collateralMarket,
    route?.collateral.decimals ?? 6
  );
  const borrowPrice = marketUsdPrice(borrowMarket, route?.borrow.decimals ?? 6);

  const collateralAmountNum = parseFloat(input.collateralAmount) || 0;
  const borrowAmountNum = parseFloat(input.borrowAmount) || 0;

  const additionalCollateralTokens =
    input.collateralSource === "wallet" ? Math.max(0, collateralAmountNum) : 0;
  const collateralUsd =
    collateralPrice != null
      ? additionalCollateralTokens * collateralPrice
      : 0;
  const borrowUsd =
    borrowPrice != null ? Math.max(0, borrowAmountNum) * borrowPrice : 0;

  const poolGlobal = positionQuery.data?.poolGlobal ?? null;
  const existingDeposit = positionQuery.data?.existingDeposit ?? null;

  const collateralFactor = collateralMarket?.collateralFactor ?? null;
  const liquidationThreshold = collateralMarket?.liquidationThreshold ?? null;
  const ltPercent =
    liquidationThreshold != null
      ? normalizeLiquidationThresholdToDecimal(liquidationThreshold) * 100
      : 85;

  const theoreticalMax =
    collateralFactor != null && borrowPrice != null
      ? theoreticalMaxBorrowTokens({
          existingCollateralUsd: poolGlobal?.totalCollateralValue ?? 0,
          existingBorrowUsd: poolGlobal?.totalBorrowValue ?? 0,
          additionalCollateralUsd: collateralUsd,
          collateralFactor,
          borrowTokenPrice: borrowPrice,
        })
      : null;

  const safeMax =
    borrowPrice != null && route
      ? safeMaxBorrowTokens({
          poolGlobal,
          additionalCollateralUsd: collateralUsd,
          liquidationThresholdPercent: ltPercent,
          borrowTokenPrice: borrowPrice,
          borrowDecimals: route.borrow.decimals,
        })
      : null;

  const totalDeposits = borrowMarket
    ? parseFloat(borrowMarket.totalDeposits) || 0
    : 0;
  const totalBorrows = borrowMarket
    ? parseFloat(borrowMarket.totalBorrows) || 0
    : 0;
  const borrowCapHuman = borrowMarket
    ? humanFromMarketCap(
        borrowMarket.maxTotalBorrows,
        route?.borrow.decimals ?? 6
      )
    : null;
  const supplyCapHuman = collateralMarket
    ? humanFromMarketCap(
        collateralMarket.maxTotalDeposits,
        route?.collateral.decimals ?? 6
      )
    : null;

  const liquidity = borrowMarket
    ? availableBorrowLiquidityTokens({
        totalDeposits,
        totalBorrows,
        borrowCap: borrowCapHuman,
        skipCashLiquidity: route?.mechanism === "wad_mint_via_borrow",
      })
    : null;

  const chainMax = chainMaxQuery.data ?? null;
  const chainOrLocalMax =
    input.collateralSource === "wallet" && collateralUsd > 0
      ? Math.max(
          chainMax ?? 0,
          safeMax ?? 0,
          theoreticalMax != null ? theoreticalMax * 0.85 : 0
        )
      : chainMax;

  const availableToBorrow = floorTokenAmount(
    effectiveAvailableBorrowTokens({
      safeMax,
      chainMax: chainOrLocalMax,
      liquidity,
    }),
    route?.borrow.decimals ?? 6
  );

  const liquidationSummary = buildLiquidationThresholdSummaryForDeposit(
    ltPercent,
    undefined,
    route?.poolId
  );

  const healthMeta = estimatePoolHealthAfterSupplyAndBorrow(
    poolGlobal,
    liquidationSummary,
    collateralUsd,
    borrowUsd
  );

  const ltDecimal = normalizeLiquidationThresholdToDecimal(ltPercent);
  const liquidationPrice =
    additionalCollateralTokens > 0
      ? estimateLiquidationPrice({
          collateralAmount: additionalCollateralTokens,
          borrowUsd,
          existingBorrowUsd: poolGlobal?.totalBorrowValue ?? 0,
          existingCollateralUsd: poolGlobal?.totalCollateralValue ?? 0,
          liquidationThresholdDecimal: ltDecimal,
        })
      : null;

  const borrowApy = borrowMarket?.borrowApyCalculation?.apy;
  const borrowAprPercent =
    borrowApy != null && Number.isFinite(borrowApy) ? borrowApy : null;
  const supplyApy = collateralMarket?.apyCalculation?.apy;
  const supplyAprPercent =
    supplyApy != null && Number.isFinite(supplyApy) ? supplyApy : null;

  const isLoading =
    marketQuery.isLoading ||
    (Boolean(address) &&
      (balanceQuery.isLoading ||
        positionQuery.isLoading ||
        chainMaxQuery.isLoading));

  const error =
    (marketQuery.error as Error | null)?.message ||
    (balanceQuery.error as Error | null)?.message ||
    (positionQuery.error as Error | null)?.message ||
    (chainMaxQuery.error as Error | null)?.message ||
    null;

  return {
    collateralPrice,
    borrowPrice,
    walletBalance: balanceQuery.data ?? null,
    existingDeposit,
    poolGlobal,
    collateralMarket,
    borrowMarket,
    collateralFactor,
    liquidationThreshold:
      liquidationThreshold != null
        ? normalizeLiquidationThresholdToDecimal(liquidationThreshold)
        : null,
    borrowAprPercent,
    supplyAprPercent,
    availableLiquidity: liquidity,
    theoreticalMax:
      theoreticalMax != null
        ? floorTokenAmount(theoreticalMax, route?.borrow.decimals ?? 6)
        : null,
    safeMax,
    chainMax,
    availableToBorrow,
    collateralUsd:
      input.collateralSource === "existing" &&
      existingDeposit != null &&
      collateralPrice != null
        ? existingDeposit * collateralPrice
        : collateralPrice != null
          ? collateralAmountNum * collateralPrice
          : 0,
    borrowUsd,
    healthBefore: healthMeta?.beforeValue ?? null,
    healthAfter: healthMeta?.value ?? null,
    liquidationPrice,
    supplyCapHuman,
    borrowCapHuman,
    isLoading,
    error,
  };
}
