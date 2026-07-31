/**
 * Light hover/RPC warm helpers for the Markets critical path.
 * Heavy warmers (admin max-borrow, withdraw ulujs/Folks) live in
 * `modalPrefetchHeavy.ts` and should be dynamically imported from hover handlers.
 */

import { getAllTokensWithDisplayInfo, type NetworkId } from "@/config";
import {
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
  fetchUserGlobalData,
  getMaxWithdrawableForMarket,
} from "@/services/lendingService";
import { fetchPoolCollateralMarketRowsForDeposit } from "@/utils/poolCollateralMarketRows";
import { resolveSupplyBorrowToken } from "@/utils/resolveSupplyBorrowToken";

export type MarketActionTokenParams = {
  userAddress: string;
  networkId: NetworkId;
  asset: string;
  poolId?: string;
  configSymbol?: string;
  marketId?: string;
  /** Markets table `_sortKey` — must match modal wallet-balance cache keys. */
  marketRowKey?: string;
};

export function resolveActionToken(params: MarketActionTokenParams) {
  const tokens = getAllTokensWithDisplayInfo(params.networkId);
  return resolveSupplyBorrowToken(
    tokens,
    params.asset,
    params.poolId,
    params.configSymbol,
    params.marketId ?? ""
  );
}

/** Debounce + cooldown per cache key to avoid RPC spam on row hover. */
export function createDebouncedPrefetch(cooldownMs = 2_500) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const lastRun = new Map<string, number>();

  return (key: string, run: () => void, delayMs = 80) => {
    const pending = timers.get(key);
    if (pending) clearTimeout(pending);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        const now = Date.now();
        if (now - (lastRun.get(key) ?? 0) < cooldownMs) return;
        lastRun.set(key, now);
        void run();
      }, delayMs)
    );
  };
}

/** Prefetch lazy modal JS chunks so first click does not wait on download/parse. */
export function prefetchSupplyBorrowModalChunk(): void {
  void import("@/components/SupplyBorrowModal");
}

export function prefetchWithdrawModalChunk(): void {
  void import("@/components/WithdrawModal");
}

export function prefetchMintModalChunk(): void {
  void import("@/components/MintModal");
}

/** Global user + per-asset borrow + pool collateral rows (fully parallel). */
export function warmBorrowModalRpc(params: MarketActionTokenParams): void {
  if (!params.userAddress) return;
  const token = resolveActionToken(params);
  const tasks: Promise<unknown>[] = [
    fetchUserGlobalData(params.userAddress, params.networkId),
  ];
  if (token?.poolId && token.underlyingContractId) {
    tasks.push(
      fetchUserBorrowBalance(
        params.userAddress,
        token.poolId,
        token.underlyingContractId,
        params.networkId
      )
    );
  }
  if (params.poolId) {
    tasks.push(
      fetchPoolCollateralMarketRowsForDeposit(
        params.userAddress,
        params.networkId,
        params.poolId
      )
    );
  }
  void Promise.all(tasks).catch(() => undefined);
}

/** Same reads as borrow; used for sToken mint modal. */
export const warmMintModalRpc = warmBorrowModalRpc;

/** Repay modal: global user data + current borrow balance. */
export function warmRepayModalRpc(params: MarketActionTokenParams): void {
  if (!params.userAddress) return;
  void fetchUserGlobalData(params.userAddress, params.networkId).catch(
    () => undefined
  );
  const token = resolveActionToken(params);
  if (!token?.poolId || !token.underlyingContractId) return;
  void fetchUserBorrowBalance(
    params.userAddress,
    token.poolId,
    token.underlyingContractId,
    params.networkId
  ).catch(() => undefined);
}

/** Markets detail sheet user position strip. */
export function warmMarketDetailUserPositionRpc(
  params: MarketActionTokenParams
): void {
  if (!params.userAddress) return;
  const token = resolveActionToken(params);
  if (!token?.poolId || !token.underlyingContractId) return;
  void Promise.all([
    fetchUserDepositBalance(
      params.userAddress,
      token.poolId,
      token.underlyingContractId,
      params.networkId
    ),
    fetchUserBorrowBalance(
      params.userAddress,
      token.poolId,
      token.underlyingContractId,
      params.networkId
    ),
    fetchUserGlobalData(params.userAddress, params.networkId),
    getMaxWithdrawableForMarket(
      token.poolId,
      token.underlyingContractId,
      params.userAddress,
      params.networkId,
      token.decimals ?? 6
    ),
  ]).catch(() => undefined);
}

export function configSymbolFromMarketRowKey(
  marketRowKey?: string
): string | undefined {
  if (!marketRowKey) return undefined;
  const parts = marketRowKey.split("|");
  if (parts.length >= 2 && parts[1]) return parts[1];
  return undefined;
}

export function marketRowKeyFromMarket(market: {
  asset?: string;
  poolId?: string;
  configSymbol?: string;
  _sortKey?: string;
}): string | undefined {
  if (market._sortKey) return market._sortKey;
  if (market.configSymbol) {
    return `${market.asset ?? ""}|${market.configSymbol}|${market.poolId ?? ""}`;
  }
  return undefined;
}

export function poolIdFromMarketRow(market: {
  marketInfo?: { poolId?: string };
  poolId?: string;
}): string | undefined {
  return market.marketInfo?.poolId ?? market.poolId;
}
