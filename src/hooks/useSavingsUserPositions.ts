import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { NetworkId } from "@/config";
import {
  fetchUserDepositBalance,
  fetchUserWalletBalance,
} from "@/services/lendingService";
import {
  savingsAccountDisplayLabel,
} from "@/services/savingsRouteResolver";
import type { SavingsRoute } from "@/types/easySavings";
import type { SavingsAccountRow } from "@/hooks/useSavingsAccounts";

export type SavingsUserPosition = {
  route: SavingsRoute;
  label: string;
  isHighYield: boolean;
  apy: number | null;
  price: number | null;
  deposit: number;
  interest: number;
  depositUsd: number;
  interestUsd: number;
  walletBalance: number | null;
  isLoading: boolean;
};

/**
 * Per-market user deposit / interest for Easy Savings account rows.
 */
export function useSavingsUserPositions(
  networkId: NetworkId,
  address: string | undefined,
  accounts: SavingsAccountRow[]
): {
  positions: SavingsUserPosition[];
  coreDepositUsd: number;
  highYieldDepositUsd: number;
  coreEarnedUsd: number;
  highYieldEarnedUsd: number;
  weightedApy: number | null;
  isLoading: boolean;
} {
  const depositQueries = useQueries({
    queries: accounts.map((row) => ({
      queryKey: [
        "easySavings",
        "deposit",
        networkId,
        address,
        row.route.poolId,
        row.route.asset.contractId,
      ],
      queryFn: async () => {
        if (!address) return { balance: 0, interest: 0 };
        return (
          (await fetchUserDepositBalance(
            address,
            row.route.poolId,
            row.route.asset.contractId,
            networkId
          )) ?? { balance: 0, interest: 0 }
        );
      },
      enabled: Boolean(address && row.route),
      staleTime: 30_000,
    })),
  });

  const walletQueries = useQueries({
    queries: accounts.map((row) => ({
      queryKey: [
        "easySavings",
        "wallet",
        networkId,
        address,
        row.route.asset.configKey,
      ],
      queryFn: async () => {
        if (!address) return null;
        return fetchUserWalletBalance(
          address,
          row.route.asset.configKey,
          networkId
        );
      },
      enabled: Boolean(address && row.route),
      staleTime: 30_000,
    })),
  });

  const positions = useMemo((): SavingsUserPosition[] => {
    return accounts.map((row, i) => {
      const dep = depositQueries[i]?.data;
      const deposit = dep?.balance ?? 0;
      const interest = dep?.interest ?? 0;
      const price = row.price;
      const depositUsd =
        price != null && deposit > 0 ? deposit * price : deposit > 0 ? deposit : 0;
      const interestUsd =
        price != null && interest > 0
          ? interest * price
          : interest > 0
            ? interest
            : 0;

      return {
        route: row.route,
        label: savingsAccountDisplayLabel(row.route),
        isHighYield: row.isHighYield,
        apy: row.apy,
        price,
        deposit,
        interest,
        depositUsd,
        interestUsd,
        walletBalance: walletQueries[i]?.data ?? null,
        isLoading:
          Boolean(depositQueries[i]?.isLoading) ||
          Boolean(walletQueries[i]?.isLoading) ||
          row.isLoading,
      };
    });
  }, [accounts, depositQueries, walletQueries]);

  const coreDepositUsd = positions
    .filter((p) => !p.isHighYield)
    .reduce((s, p) => s + p.depositUsd, 0);
  const highYieldDepositUsd = positions
    .filter((p) => p.isHighYield)
    .reduce((s, p) => s + p.depositUsd, 0);
  const coreEarnedUsd = positions
    .filter((p) => !p.isHighYield)
    .reduce((s, p) => s + p.interestUsd, 0);
  const highYieldEarnedUsd = positions
    .filter((p) => p.isHighYield)
    .reduce((s, p) => s + p.interestUsd, 0);

  const weightedApy = useMemo(() => {
    let weight = 0;
    let sum = 0;
    for (const p of positions) {
      if (p.depositUsd <= 0 || p.apy == null || !Number.isFinite(p.apy)) continue;
      sum += p.depositUsd * p.apy;
      weight += p.depositUsd;
    }
    if (weight <= 0) return null;
    return sum / weight;
  }, [positions]);

  const isLoading =
    Boolean(address) &&
    (depositQueries.some((q) => q.isLoading) ||
      walletQueries.some((q) => q.isLoading));

  return {
    positions,
    coreDepositUsd,
    highYieldDepositUsd,
    coreEarnedUsd,
    highYieldEarnedUsd,
    weightedApy,
    isLoading,
  };
}
