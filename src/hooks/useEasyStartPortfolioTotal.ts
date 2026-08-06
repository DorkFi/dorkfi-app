import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import type { NetworkId } from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { useSavingsAccounts } from "@/hooks/useSavingsAccounts";
import { useSavingsUserPositions } from "@/hooks/useSavingsUserPositions";
import {
  fetchAlgorandUsdcBalance,
  fetchBaseUsdcBalance,
} from "@/lib/easyStart/baseBalances";

/**
 * Portfolio total aligned with Easy Savings “Portfolio Balance”:
 * transferable wallet USDC (Algorand + Base) + core + higher-yield deposits.
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
  const { currentNetwork } = useNetwork();
  const networkId = currentNetwork as NetworkId;
  const privy = usePrivyEasyStart();
  const { activeAccount } = useDorkFiWalletAdapter();

  const algoAddress =
    privy.algorandAddress ?? activeAccount?.address ?? null;
  const evmAddress = (privy.evmAddress ?? null) as Address | null;

  const { all: accounts } = useSavingsAccounts(networkId);
  const {
    coreDepositUsd,
    highYieldDepositUsd,
    isLoading: positionsLoading,
  } = useSavingsUserPositions(networkId, algoAddress ?? undefined, accounts);

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

  const walletUsd =
    (algoWalletUsd ?? 0) + (baseWalletUsd ?? 0);
  const depositUsd =
    Math.max(0, coreDepositUsd) + Math.max(0, highYieldDepositUsd);
  const totalUsd = walletUsd + depositUsd;

  const walletLoading =
    (Boolean(algoAddress) && algoLoading && !algoUsdc) ||
    (Boolean(evmAddress) && baseLoading && !baseUsdc);

  const isLoading = walletLoading || (Boolean(algoAddress) && positionsLoading);

  const hasWallet = algoReady || baseReady;
  const hasDeposits = depositUsd > 1e-9;
  const hasAny = hasWallet || hasDeposits;

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
