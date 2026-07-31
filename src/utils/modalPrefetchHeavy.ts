/**
 * Heavy modal RPC warmers (admin max-borrow simulate, LendingPool/ulujs,
 * Folks adapters). Import this module from already-heavy surfaces
 * (SupplyBorrowModal, Portfolio) or via dynamic `import()` from Markets hover
 * so the Markets critical chunk stays free of adminService / ulujs.
 */

import {
  getNetworkConfig,
  getAlgorandNetworkFromNetworkId,
  getFolksAdapterForPhase,
  getTokenConfig,
} from "@/config";
import { calculateMaxBorrowAmount } from "@/services/adminService";
import {
  fetchUserGlobalDataForPool,
  fetchMarketInfoFromContract,
  getMaxWithdrawableForMarket,
  detectNt200UserBalanceBox,
} from "@/services/lendingService";
import { estimateFolksDepositMintedFAssetAmount } from "@/services/folksDepositAdapter";
import algorandService, { type AlgorandNetwork } from "@/services/algorandService";
import { CONTRACT } from "ulujs";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import algosdk from "algosdk";
import BigNumber from "bignumber.js";
import {
  resolveActionToken,
  warmBorrowModalRpc,
  type MarketActionTokenParams,
} from "@/utils/modalPrefetch";

/** Per-pool global data + max borrow (SupplyBorrowModal mount / borrow hover). */
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
    token.decimals ?? 6
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
        new BigNumber(1).shiftedBy(token.decimals ?? 6).toFixed(0)
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
