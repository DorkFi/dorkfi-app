import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import {
  fetchAlgorandAlgoTotal,
  fetchAlgorandUsdcBalance,
  fetchBaseUsdcBalance,
} from "@/lib/easyStart/baseBalances";
import { useTokenPrice } from "@/hooks/useTokenPrice";

/**
 * Easy Start menu total: Algorand ALGO plus transferable USDC on Algorand and Base.
 */
export function useEasyStartPortfolioTotal(): {
  totalUsd: number;
  walletUsd: number;
  depositUsd: number;
  algoWalletUsd: number | null;
  baseWalletUsd: number | null;
  isLoading: boolean;
  isUnavailable: boolean;
  hasAny: boolean;
} {
  const privy = usePrivyEasyStart();
  const { activeAccount } = useDorkFiWalletAdapter();

  const algoAddress =
    privy.algorandAddress ?? activeAccount?.address ?? null;
  const evmAddress = (privy.evmAddress ?? null) as Address | null;
  const { price: algoPriceUsd } = useTokenPrice(
    algoAddress ? "ALGO" : "",
    "algorand-mainnet"
  );

  const { data: algoNative } = useQuery({
    queryKey: ["easy-start-algo-total", algoAddress],
    queryFn: () => fetchAlgorandAlgoTotal(algoAddress!),
    enabled: Boolean(algoAddress),
    refetchInterval: 20_000,
  });

  const {
    data: algoUsdc,
    isLoading: algoLoading,
    isError: algoError,
  } = useQuery({
    queryKey: ["easy-start-algo-usdc", algoAddress],
    queryFn: () => fetchAlgorandUsdcBalance(algoAddress!),
    enabled: Boolean(algoAddress),
    refetchInterval: 20_000,
  });

  const {
    data: baseUsdc,
    isLoading: baseLoading,
    isError: baseError,
  } = useQuery({
    queryKey: ["easy-start-base-usdc", evmAddress],
    queryFn: () => fetchBaseUsdcBalance(evmAddress!),
    enabled: Boolean(evmAddress),
    refetchInterval: 20_000,
  });

  const algoNum = algoUsdc
    ? Number.parseFloat(algoUsdc.formatted)
    : null;
  const baseNum = baseUsdc
    ? Number.parseFloat(baseUsdc.formatted)
    : null;

  const algoReady = algoNum !== null && !Number.isNaN(algoNum);
  const baseReady = baseNum !== null && !Number.isNaN(baseNum);

  const algoWalletUsd = algoReady ? Math.max(0, algoNum!) : null;
  const baseWalletUsd = baseReady ? Math.max(0, baseNum!) : null;

  const algoNativeNum = algoNative
    ? Number.parseFloat(algoNative.formatted)
    : 0;
  const algoNativeUsd =
    Number.isFinite(algoNativeNum) && algoNativeNum > 0 && algoPriceUsd > 0
      ? algoNativeNum * algoPriceUsd
      : 0;

  const walletUsd =
    (algoWalletUsd ?? 0) + (baseWalletUsd ?? 0) + algoNativeUsd;
  const depositUsd = 0;
  const totalUsd = walletUsd;

  const walletLoading =
    (Boolean(algoAddress) && algoLoading && !algoUsdc) ||
    (Boolean(evmAddress) && baseLoading && !baseUsdc);

  const isLoading = walletLoading;

  const hasWallet = algoReady || baseReady;
  const hasDeposits = depositUsd > 1e-9;
  const hasAlgo = Number.isFinite(algoNativeNum) && algoNativeNum > 0;
  const hasAny = hasWallet || hasDeposits || hasAlgo;

  const isUnavailable =
    !isLoading &&
    !hasAny &&
    ((Boolean(algoAddress) && algoError) ||
      (Boolean(evmAddress) && baseError) ||
      (!algoAddress && !evmAddress));

  return {
    totalUsd,
    walletUsd,
    depositUsd,
    algoWalletUsd,
    baseWalletUsd,
    isLoading,
    isUnavailable,
    hasAny,
  };
}
