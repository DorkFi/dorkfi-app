import type { QueryClient } from "@tanstack/react-query";
import { invalidateUserPositionRpcCache } from "@/utils/rpcReadCache";
import { invalidateWalletBalanceRpc } from "@/utils/walletBalanceRpc";

export type EasySavingsDepositBalance = {
  balance: number;
  interest: number;
};

export function easySavingsDepositQueryKey(
  networkId: string,
  address: string | undefined,
  poolId: string | undefined,
  contractId: string | undefined
) {
  return [
    "easySavings",
    "deposit",
    networkId,
    address,
    poolId,
    contractId,
  ] as const;
}

export function easySavingsWalletQueryKey(
  networkId: string,
  address: string | undefined,
  configKey: string | undefined
) {
  return ["easySavings", "wallet", networkId, address, configKey] as const;
}

/**
 * Seed the Earn deposit query (and wallet, when known) so the card updates
 * before the post-tx RPC refetch lands.
 *
 * `delta` is token units: positive for deposit, negative for withdraw.
 */
export function applyOptimisticSavingsPosition(params: {
  queryClient: QueryClient;
  networkId: string;
  address: string;
  poolId: string;
  contractId: string;
  configKey?: string;
  delta: number;
}): { nextBalance: number } {
  const {
    queryClient,
    networkId,
    address,
    poolId,
    contractId,
    configKey,
    delta,
  } = params;
  if (!Number.isFinite(delta) || delta === 0) {
    const key = easySavingsDepositQueryKey(
      networkId,
      address,
      poolId,
      contractId
    );
    const current =
      queryClient.getQueryData<EasySavingsDepositBalance | null>(key);
    return { nextBalance: Math.max(0, current?.balance ?? 0) };
  }

  const key = easySavingsDepositQueryKey(
    networkId,
    address,
    poolId,
    contractId
  );
  const previous =
    queryClient.getQueryData<EasySavingsDepositBalance | null>(key);
  const nextBalance = Math.max(0, (previous?.balance ?? 0) + delta);
  queryClient.setQueryData<EasySavingsDepositBalance>(key, {
    balance: nextBalance,
    interest: previous?.interest ?? 0,
  });

  if (configKey) {
    const walletKey = easySavingsWalletQueryKey(
      networkId,
      address,
      configKey
    );
    const wallet = queryClient.getQueryData<number | null>(walletKey);
    if (wallet != null && Number.isFinite(wallet)) {
      queryClient.setQueryData(walletKey, Math.max(0, wallet - delta));
    }
  }

  return { nextBalance };
}

/**
 * Bust RPC + React Query savings caches after a confirmed supply/withdraw.
 * Call after {@link applyOptimisticSavingsPosition} so the UI stays on the
 * seeded balance while the live refetch runs.
 */
export function invalidateEasySavingsAfterTx(params: {
  queryClient: QueryClient;
  networkId: string;
  address?: string | null;
}): void {
  const { queryClient, networkId, address } = params;
  const trimmed = address?.trim();
  if (trimmed) {
    invalidateUserPositionRpcCache(networkId, trimmed);
    invalidateWalletBalanceRpc(trimmed);
  }
  void queryClient.invalidateQueries({ queryKey: ["easySavings"] });
  void queryClient.invalidateQueries({ queryKey: ["easy-start-base-usdc"] });
  void queryClient.invalidateQueries({ queryKey: ["easy-start-algo-usdc"] });
}
