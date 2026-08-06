import { useQuery } from "@tanstack/react-query";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import type { NetworkId } from "@/config";
import { useWadUsdcTinymanApyPercent } from "@/hooks/useWadUsdcTinymanApyPercent";
import {
  fetchMarketInfo,
  fetchUserDepositBalance,
  fetchUserWalletBalance,
  type MarketInfo,
} from "@/services/lendingService";
import { isLeveragedWadUsdcRoute } from "@/services/leveragedWadLpService";
import type { SavingsRoute } from "@/types/easySavings";
import { usdPerTokenFromMarketInfoPrice } from "@/utils/assetDecimals";
import { floorTokenAmount } from "@/utils/easyBorrowMath";

export type EasySavingsQuoteInput = {
  networkId: NetworkId;
  route: SavingsRoute | null;
  amount: string;
};

export type EasySavingsQuote = {
  price: number | null;
  walletBalance: number | null;
  existingDeposit: number | null;
  /** Accrued supply interest on the deposited position (token units). */
  earnedInterest: number | null;
  market: MarketInfo | null;
  supplyApyPercent: number | null;
  supplyCapHuman: number | null;
  totalDepositsHuman: number | null;
  remainingSupplyCap: number | null;
  amountUsd: number;
  existingDepositUsd: number;
  earnedInterestUsd: number;
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

function parseHuman(cap: string | undefined): number | null {
  if (cap == null || cap === "") return null;
  const n = parseFloat(cap);
  return Number.isFinite(n) ? n : null;
}

/**
 * Live quote for Easy Savings (supply). Amount changes are local math.
 */
export function useEasySavingsQuote(
  input: EasySavingsQuoteInput
): EasySavingsQuote {
  const { activeAccount } = useDorkFiWalletAdapter();
  const address = activeAccount?.address;
  const route = input.route;
  const networkId = input.networkId;

  const marketQuery = useQuery({
    queryKey: [
      "easySavings",
      "market",
      networkId,
      route?.poolId,
      route?.asset.contractId,
    ],
    enabled: Boolean(route),
    staleTime: 60_000,
    queryFn: async () => {
      if (!route) return null;
      return fetchMarketInfo(
        route.poolId,
        route.asset.contractId,
        networkId
      );
    },
  });

  const balanceQuery = useQuery({
    queryKey: [
      "easySavings",
      "wallet",
      networkId,
      address,
      route?.asset.configKey,
    ],
    enabled: Boolean(route && address),
    staleTime: 30_000,
    queryFn: async () => {
      if (!route || !address) return null;
      return fetchUserWalletBalance(
        address,
        route.asset.configKey,
        networkId
      );
    },
  });

  const positionQuery = useQuery({
    queryKey: [
      "easySavings",
      "deposit",
      networkId,
      address,
      route?.poolId,
      route?.asset.contractId,
    ],
    enabled: Boolean(route && address),
    staleTime: 30_000,
    queryFn: async () => {
      if (!route || !address) return null;
      return fetchUserDepositBalance(
        address,
        route.poolId,
        route.asset.contractId,
        networkId
      );
    },
  });

  const isWadUsdc = isLeveragedWadUsdcRoute(route?.asset.configKey);
  const tinymanApy = useWadUsdcTinymanApyPercent(networkId, isWadUsdc);

  const market = marketQuery.data ?? null;
  const price = marketUsdPrice(market, route?.asset.decimals ?? 6);
  const amountNum = parseFloat(input.amount) || 0;
  const existingDeposit = positionQuery.data?.balance ?? null;
  const earnedInterest = positionQuery.data?.interest ?? null;

  const supplyCapHuman = market
    ? parseHuman(market.maxTotalDeposits)
    : null;
  const totalDepositsHuman = market
    ? parseHuman(market.totalDeposits)
    : null;

  let remainingSupplyCap: number | null = null;
  if (supplyCapHuman != null && supplyCapHuman > 0) {
    const used = totalDepositsHuman ?? 0;
    remainingSupplyCap = floorTokenAmount(
      Math.max(0, supplyCapHuman - used),
      route?.asset.decimals ?? 6
    );
  }

  const apy = market?.apyCalculation?.apy;
  const marketSupplyApyPercent =
    apy != null && Number.isFinite(apy)
      ? apy
      : market?.supplyRate != null && Number.isFinite(market.supplyRate)
        ? market.supplyRate * 100
        : null;

  // WAD/USDC Higher Yield earn is dominated by Tinyman pool fees; prefer live pool APY.
  const supplyApyPercent = isWadUsdc
    ? tinymanApy.apyPercent ??
      (tinymanApy.isLoading ? null : marketSupplyApyPercent)
    : marketSupplyApyPercent;

  const isLoading =
    marketQuery.isLoading ||
    (isWadUsdc && tinymanApy.isLoading) ||
    (Boolean(address) &&
      (balanceQuery.isLoading || positionQuery.isLoading));

  const error =
    (marketQuery.error as Error | null)?.message ||
    (balanceQuery.error as Error | null)?.message ||
    (positionQuery.error as Error | null)?.message ||
    null;

  return {
    price,
    walletBalance: balanceQuery.data ?? null,
    existingDeposit,
    earnedInterest,
    market,
    supplyApyPercent,
    supplyCapHuman,
    totalDepositsHuman,
    remainingSupplyCap,
    amountUsd: price != null ? amountNum * price : 0,
    existingDepositUsd:
      price != null && existingDeposit != null
        ? existingDeposit * price
        : 0,
    earnedInterestUsd:
      price != null && earnedInterest != null
        ? earnedInterest * price
        : 0,
    isLoading,
    error,
  };
}
