import { useQuery } from "@tanstack/react-query";
import type { NetworkId } from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { fetchUserGlobalData } from "@/services/lendingService";

const DUST_USD = 1e-6;

/** Show token accrued only when the index increment is above this. */
export const ACCRUED_TOKEN_DUST = 1e-6;

export function isAccruedDisplayable(interest: number | null | undefined): boolean {
  return interest != null && Number.isFinite(interest) && interest > ACCRUED_TOKEN_DUST;
}

export function formatBorrowApyLabel(
  apyPercent: number | null | undefined
): string | null {
  if (apyPercent == null || !Number.isFinite(apyPercent) || apyPercent <= 0) {
    return null;
  }
  return `${apyPercent.toFixed(2)}% APY`;
}

export const easyStartBorrowDebtQueryKey = (
  networkId: string,
  address: string
) => ["easy-start-borrow-debt", networkId, address] as const;

export type EasyStartBorrowDebt = {
  totalUsd: number;
  collateralUsd: number;
  healthFactor: number | null;
};

/**
 * Protocol borrow debt for the Easy Start Algorand account.
 * USD totals come from pooled user-global data. Wallet holdings are not included.
 */
export function useEasyStartBorrowDebt(): {
  totalUsd: number;
  collateralUsd: number;
  healthFactor: number | null;
  hasDebt: boolean;
  isLoading: boolean;
} {
  const { currentNetwork } = useNetwork();
  const networkId = currentNetwork as NetworkId;
  const privy = usePrivyEasyStart();
  const { activeAccount } = useDorkFiWalletAdapter();
  const address =
    (privy.algorandAddress ?? activeAccount?.address ?? "").trim();

  const query = useQuery({
    queryKey: easyStartBorrowDebtQueryKey(networkId, address),
    enabled: Boolean(address),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: address ? 20_000 : false,
    queryFn: async (): Promise<EasyStartBorrowDebt> => {
      const global = await fetchUserGlobalData(address, networkId);
      const totalUsd = Math.max(0, global?.totalBorrowValue ?? 0);
      const collateralUsd = Math.max(0, global?.totalCollateralValue ?? 0);
      const healthFactor =
        global?.healthFactorIndex != null &&
        Number.isFinite(global.healthFactorIndex)
          ? global.healthFactorIndex
          : null;
      if (totalUsd <= DUST_USD) {
        return { totalUsd: 0, collateralUsd, healthFactor };
      }
      return { totalUsd, collateralUsd, healthFactor };
    },
  });

  const totalUsd = query.data?.totalUsd ?? 0;
  const collateralUsd = query.data?.collateralUsd ?? 0;
  const healthFactor = query.data?.healthFactor ?? null;
  const hasDebt = totalUsd > DUST_USD;

  return {
    totalUsd: hasDebt ? totalUsd : 0,
    collateralUsd,
    healthFactor,
    hasDebt,
    isLoading: Boolean(address && query.isPending),
  };
}
