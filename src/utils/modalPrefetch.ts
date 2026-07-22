/**
 * Debounced hover prefetch for supply / borrow / withdraw / repay modals.
 * Warms RPC read cache (see rpcReadCache) before the user clicks.
 */

import {
  getAllTokensWithDisplayInfo,
  getNetworkConfig,
  getAlgorandNetworkFromNetworkId,
  getFolksAdapterForPhase,
  getTokenConfig,
  type NetworkId,
} from "@/config";
import { calculateMaxBorrowAmount } from "@/services/adminService";
import {
  fetchUserBorrowBalance,
  fetchUserDepositBalance,
  fetchUserGlobalData,
  fetchUserGlobalDataForPool,
  fetchMarketInfoFromContract,
  getMaxWithdrawableForMarket,
  detectNt200UserBalanceBox,
} from "@/services/lendingService";
import { estimateFolksDepositMintedFAssetAmount } from "@/services/folksDepositAdapter";
import { fetchPoolCollateralMarketRowsForDeposit } from "@/utils/poolCollateralMarketRows";
import { resolveSupplyBorrowToken } from "@/components/SupplyBorrowModal";
import algorandService, { type AlgorandNetwork } from "@/services/algorandService";
import { CONTRACT } from "ulujs";
import {
  APP_SPEC as LendingPoolAppSpec,
  UserData,
} from "@/clients/DorkFiLendingPoolClient";
import algosdk from "algosdk";
import BigNumber from "bignumber.js";

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

function resolveActionToken(params: MarketActionTokenParams) {
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

function prefetchKey(prefix: string, params: MarketActionTokenParams): string {
  return [
    prefix,
    params.networkId,
    params.userAddress,
    params.asset,
    params.poolId ?? "",
    params.configSymbol ?? "",
    params.marketId ?? "",
  ].join(":");
}

/** Global user + per-asset borrow + pool collateral rows. */
export function warmBorrowModalRpc(params: MarketActionTokenParams): void {
  if (!params.userAddress) return;
  const key = prefetchKey("borrow", params);
  void Promise.all([
    fetchUserGlobalData(params.userAddress, params.networkId),
    (async () => {
      const token = resolveActionToken(params);
      if (!token?.poolId || !token.underlyingContractId) return;
      await fetchUserBorrowBalance(
        params.userAddress,
        token.poolId,
        token.underlyingContractId,
        params.networkId
      );
      if (params.poolId) {
        await fetchPoolCollateralMarketRowsForDeposit(
          params.userAddress,
          params.networkId,
          params.poolId
        );
      }
    })(),
  ]).catch(() => undefined);
}

/** Same reads as borrow; used for sToken mint modal. */
export const warmMintModalRpc = warmBorrowModalRpc;

/** Per-pool global data + max borrow (SupplyBorrowModal mount). */
export function warmBorrowModalMaxAndPool(params: MarketActionTokenParams): void {
  warmBorrowModalRpc(params);
  const token = resolveActionToken(params);
  if (!token?.poolId || !token.underlyingContractId || !params.userAddress) {
    return;
  }
  void fetchUserGlobalDataForPool(
    params.userAddress,
    params.networkId,
    token.poolId
  ).catch(() => undefined);
  const storageAppId = getNetworkConfig(params.networkId)?.contracts
    ?.appStorageId;
  void calculateMaxBorrowAmount(
    token.poolId,
    params.userAddress,
    token.underlyingContractId,
    storageAppId ? Number(storageAppId) : undefined
  ).catch(() => undefined);

  // Warm nt200 balance-box detection so borrow() can pick a single simulate path
  const algodNet = getAlgorandNetworkFromNetworkId(params.networkId);
  if (algodNet) {
    void (async () => {
      try {
        const clients = algorandService.initializeClients(
          algodNet as AlgorandNetwork
        );
        await detectNt200UserBalanceBox(
          clients.algod,
          token.underlyingContractId,
          params.userAddress
        );
      } catch {
        /* ignore */
      }
    })();
  }
}

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

/** Withdraw indices (market + user deposit index). */
export async function warmWithdrawIndicesRpc(
  params: MarketActionTokenParams
): Promise<void> {
  if (!params.userAddress) return;
  const token = resolveActionToken(params);
  if (!token?.poolId || !token.underlyingContractId) return;

  try {
    await fetchMarketInfoFromContract(
      token.poolId,
      token.underlyingContractId,
      params.networkId
    );
  } catch {
    /* ignore */
  }

  const networkConfig = getNetworkConfig(params.networkId);
  const algodNet = getAlgorandNetworkFromNetworkId(params.networkId);
  if (!algodNet) return;

  try {
    const clients = algorandService.initializeClients(algodNet as AlgorandNetwork);
    const ci = new CONTRACT(
      Number(token.poolId),
      clients.algod,
      undefined,
      { ...LendingPoolAppSpec.contract, events: [] },
      {
        addr: algosdk.encodeAddress(
          algosdk.getApplicationAddress(Number(token.poolId)).publicKey
        ),
        sk: new Uint8Array(),
      }
    );
    ci.setFee(2000);
    await ci.get_user(
      params.userAddress,
      Number(token.underlyingContractId)
    );
  } catch {
    /* ignore */
  }
  void networkConfig;
}

/** Max withdraw + optional Folks mint ratio (RPC cache). */
export function warmMaxWithdrawRpc(params: MarketActionTokenParams): void {
  if (!params.userAddress) return;
  const token = resolveActionToken(params);
  if (!token?.poolId || !token.underlyingContractId) return;

  void getMaxWithdrawableForMarket(
    token.poolId,
    token.underlyingContractId,
    params.userAddress,
    params.networkId,
    token.decimals
  ).catch(() => undefined);

  const cfgSym = token.configKey ?? token.originalSymbol ?? token.symbol;
  const rawTc = getTokenConfig(params.networkId, cfgSym);
  const tc = Array.isArray(rawTc)
    ? rawTc.find((c) => String(c.poolId) === String(token.poolId)) ?? rawTc[0]
    : rawTc;
  const folksSide = tc
    ? getFolksAdapterForPhase(tc, "withdraw") ??
      getFolksAdapterForPhase(tc, "deposit")
    : undefined;
  if (!folksSide || params.networkId !== "algorand-mainnet") return;

  const algodNet = getAlgorandNetworkFromNetworkId(params.networkId);
  if (!algodNet) return;
  void (async () => {
    try {
      const clients = algorandService.initializeClients(algodNet as AlgorandNetwork);
      const oneUnderlyingAtomic = BigInt(
        new BigNumber(1).shiftedBy(token.decimals).toFixed(0)
      );
      await estimateFolksDepositMintedFAssetAmount({
        poolName: folksSide.folksParams.pool,
        underlyingAmount: oneUnderlyingAtomic,
        algod: clients.algod,
      });
    } catch {
      /* ignore */
    }
  })();
}

export function warmWithdrawModalRpc(params: MarketActionTokenParams): void {
  void warmWithdrawIndicesRpc(params);
  warmMaxWithdrawRpc(params);
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
      token.decimals
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
