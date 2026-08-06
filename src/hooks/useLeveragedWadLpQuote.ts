import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import type { NetworkId } from "@/config";
import type { MarketInfo } from "@/services/lendingService";
import {
  quoteLeveragedWadLp,
  sizeUsdcDeploySplit,
  type LeveragedWadLpQuoteSnapshot,
} from "@/services/leveragedWadLpService";

export type UseLeveragedWadLpQuoteInput = {
  networkId: NetworkId;
  /** Total USDC to deploy (75% collateral / 25% pair). */
  totalUsdc: string;
  lpMarketInfo?: MarketInfo | null;
  enabled?: boolean;
};

/**
 * Live quote for USDC-first leveraged WAD/USDC Higher Yield.
 */
export function useLeveragedWadLpQuote(
  input: UseLeveragedWadLpQuoteInput
): LeveragedWadLpQuoteSnapshot & { isLoading: boolean } {
  const { activeAccount } = useWallet();
  const address = activeAccount?.address;
  const totalUsdcNum = parseFloat(input.totalUsdc) || 0;
  const enabled = input.enabled ?? true;

  const baseQuery = useQuery({
    queryKey: ["leveragedWadLp", "base", input.networkId, address ?? null],
    enabled: enabled && Boolean(input.networkId),
    staleTime: 30_000,
    queryFn: () =>
      quoteLeveragedWadLp({
        networkId: input.networkId,
        userAddress: address,
        totalUsdc: 0,
        lpMarketInfo: input.lpMarketInfo,
      }),
  });

  const sizedQuery = useQuery({
    queryKey: [
      "leveragedWadLp",
      "sized",
      input.networkId,
      address ?? null,
      totalUsdcNum > 0 ? totalUsdcNum.toFixed(6) : "0",
      input.lpMarketInfo?.supplyRate ?? null,
    ],
    enabled: enabled && Boolean(input.networkId) && totalUsdcNum > 0,
    staleTime: 15_000,
    queryFn: () =>
      quoteLeveragedWadLp({
        networkId: input.networkId,
        userAddress: address,
        totalUsdc: totalUsdcNum,
        lpMarketInfo: input.lpMarketInfo,
      }),
  });

  const base = baseQuery.data;
  const sized = sizedQuery.data;

  if (!base && !sized) {
    return {
      pair: null,
      usdcCollateralRoute: null,
      borrow: null,
      usdcBalance: null,
      algoBalance: null,
      usdcPerWad: null,
      split: null,
      estimatedLpTokens: null,
      healthAfter: null,
      maxWadAfterCollateral: null,
      lpSupplyApyPercent: null,
      error: null,
      isLoading: baseQuery.isLoading || baseQuery.isFetching,
    };
  }

  const src = sized ?? base!;
  const usdcPerWad = src.usdcPerWad ?? base?.usdcPerWad ?? null;
  const localSplit =
    sized?.split ??
    (totalUsdcNum > 0 ? sizeUsdcDeploySplit(totalUsdcNum, usdcPerWad) : null);

  return {
    pair: src.pair ?? base?.pair ?? null,
    usdcCollateralRoute:
      src.usdcCollateralRoute ?? base?.usdcCollateralRoute ?? null,
    borrow: src.borrow ?? base?.borrow ?? null,
    usdcBalance: src.usdcBalance ?? base?.usdcBalance ?? null,
    algoBalance: src.algoBalance ?? base?.algoBalance ?? null,
    usdcPerWad,
    split: localSplit,
    estimatedLpTokens: sized?.estimatedLpTokens ?? null,
    healthAfter: sized?.healthAfter ?? null,
    maxWadAfterCollateral:
      sized?.maxWadAfterCollateral ?? base?.maxWadAfterCollateral ?? null,
    lpSupplyApyPercent:
      sized?.lpSupplyApyPercent ?? base?.lpSupplyApyPercent ?? null,
    error: sized?.error ?? base?.error ?? null,
    isLoading:
      baseQuery.isLoading ||
      baseQuery.isFetching ||
      (totalUsdcNum > 0 && (sizedQuery.isLoading || sizedQuery.isFetching)),
  };
}
