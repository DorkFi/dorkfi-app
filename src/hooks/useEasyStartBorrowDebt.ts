import { useQuery } from "@tanstack/react-query";
import { getLendingPoolLabel, type NetworkId } from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { listEasyBorrowDebtMarkets } from "@/services/borrowRouteResolver";
import {
  fetchMarketInfo,
  fetchUserBorrowBalance,
  fetchUserGlobalData,
} from "@/services/lendingService";
import type { EasyBorrowMarketRef } from "@/types/easyBorrow";

const DUST_USD = 1e-6;
const DUST_TOKEN = 1e-8;

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

export type EasyStartBorrowPosition = {
  id: string;
  symbol: string;
  amount: number;
  interest: number;
  apyPercent: number | null;
  logoPath?: string;
  market: EasyBorrowMarketRef;
  marketLabel: string;
};

export type EasyStartBorrowDebt = {
  totalUsd: number;
  collateralUsd: number;
  healthFactor: number | null;
  positions: EasyStartBorrowPosition[];
};

/**
 * Protocol borrow debt for the Easy Start Algorand account.
 * USD totals come from pooled user-global data; token amounts from Easy Borrow
 * WAD/USDC markets. Positions stay keyed by pool + contract so repay can target
 * the correct market. Wallet holdings are not included — this is a liability.
 */
export function useEasyStartBorrowDebt(): {
  totalUsd: number;
  collateralUsd: number;
  healthFactor: number | null;
  positions: EasyStartBorrowPosition[];
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
        return { totalUsd: 0, collateralUsd, healthFactor, positions: [] };
      }

      const markets = listEasyBorrowDebtMarkets(networkId);
      const rows = await Promise.all(
        markets.map(async (market) => {
          const data = await fetchUserBorrowBalance(
            address,
            market.poolId,
            market.contractId,
            networkId
          );
          return {
            id: `${market.poolId}:${market.contractId}`,
            symbol: market.symbol,
            logoPath: market.logoPath,
            amount: data?.balance ?? 0,
            interest: data?.interest ?? 0,
            apyPercent: null as number | null,
            market,
            marketLabel:
              getLendingPoolLabel(networkId, market.poolId) ?? market.poolId,
          };
        })
      );

      const open = rows
        .filter((row) => row.amount > DUST_TOKEN)
        .sort((a, b) => b.amount - a.amount);

      const positions = await Promise.all(
        open.map(async (row) => {
          try {
            const info = await fetchMarketInfo(
              row.market.poolId,
              row.market.contractId,
              networkId
            );
            const apy = info?.borrowApyCalculation?.apy;
            return {
              ...row,
              apyPercent:
                apy != null && Number.isFinite(apy) ? apy : null,
            };
          } catch {
            return row;
          }
        })
      );

      return {
        totalUsd,
        collateralUsd,
        healthFactor,
        positions,
      };
    },
  });

  const totalUsd = query.data?.totalUsd ?? 0;
  const collateralUsd = query.data?.collateralUsd ?? 0;
  const healthFactor = query.data?.healthFactor ?? null;
  const positions = query.data?.positions ?? [];
  const hasDebt = totalUsd > DUST_USD || positions.length > 0;

  return {
    totalUsd: hasDebt ? totalUsd : 0,
    collateralUsd,
    healthFactor,
    positions: hasDebt ? positions : [],
    hasDebt,
    isLoading: Boolean(address && query.isPending),
  };
}
