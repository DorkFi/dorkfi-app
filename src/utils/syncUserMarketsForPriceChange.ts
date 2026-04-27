/**
 * Build, sign, and submit `sync_user_market_for_price_change` for one pool (optionally one market).
 * After oracle price updates, this refreshes a user’s stored position price / index state on the lending app.
 * Used from Portfolio and Admin.
 */
import algosdk from "algosdk";
import { abi, CONTRACT } from "ulujs";
import { APP_SPEC as LendingPoolAppSpec } from "@/clients/DorkFiLendingPoolClient";
import algorandService from "@/services/algorandService";
import {
  getAllTokensWithDisplayInfo,
  getAlgorandNetworkFromNetworkId,
  getEnabledNetworks,
  getNetworkConfig,
  isAlgorandCompatibleNetwork,
  type NetworkId,
} from "@/config";
import { updateTransactionMetadata } from "@/utils/transactionUtils";

export type SyncUserMarketsForPriceChangeResult = {
  txid: string;
  networkId: NetworkId;
  marketsSynced: number;
  poolId: string;
};

function resolveNetworkForPool(poolId: string): NetworkId | null {
  for (const networkId of getEnabledNetworks()) {
    const networkConfig = getNetworkConfig(networkId);
    const lendingPools = networkConfig?.contracts?.lendingPools || [];
    if (lendingPools.some((p) => String(p) === String(poolId))) {
      return networkId as NetworkId;
    }
  }
  return null;
}

/**
 * @param userAddress - Account whose user market data is synced (usually the same as the signing wallet)
 * @param signTransactions - Wallet `signTransactions` (unsigned txn bytes, same as Portfolio)
 */
export async function signAndSendSyncUserMarketsForPriceChangeTx(
  userAddress: string,
  poolId: string,
  marketId: string | undefined,
  signWalletAddress: string,
  signTransactions: (
    txns: Uint8Array[]
  ) => Promise<Uint8Array | Uint8Array[]>
): Promise<SyncUserMarketsForPriceChangeResult> {
  if (!userAddress?.trim() || !poolId?.trim()) {
    throw new Error("user address and pool app id are required");
  }

  const marketNetworkId = resolveNetworkForPool(String(poolId));
  if (!marketNetworkId) {
    throw new Error(
      `No enabled network in config contains lending pool id ${poolId}. Check config lendingPools.`
    );
  }
  if (!isAlgorandCompatibleNetwork(marketNetworkId)) {
    throw new Error("Only Algorand-compatible networks support this call.");
  }

  const algorandNetwork = getAlgorandNetworkFromNetworkId(marketNetworkId);
  if (!algorandNetwork) {
    throw new Error(`No Algorand client mapping for network ${marketNetworkId}`);
  }

  const clients = algorandService.initializeClients(algorandNetwork);

  let marketsToSync: Array<{ poolId: string; marketId: string }> = [];

  if (marketId?.trim()) {
    marketsToSync = [{ poolId, marketId: String(marketId).trim() }];
  } else {
    const tokens = getAllTokensWithDisplayInfo(marketNetworkId);
    const matchingTokens = tokens.filter((t) => String(t.poolId) === String(poolId));
    for (const token of matchingTokens) {
      if (token.underlyingContractId) {
        marketsToSync.push({
          poolId,
          marketId: token.underlyingContractId,
        });
      }
    }
  }

  if (marketsToSync.length === 0) {
    throw new Error(
      marketId?.trim()
        ? "No market to sync (check market / underlying id)."
        : "No token config markets for this pool — provide a market id or check config."
    );
  }

  const ci = new CONTRACT(
    Number(poolId),
    clients.algod,
    clients.indexer,
    abi.custom,
    {
      addr: signWalletAddress,
      sk: new Uint8Array(),
    }
  );

  const builder = {
    lending: new CONTRACT(
      Number(poolId),
      clients.algod,
      clients.indexer,
      { ...LendingPoolAppSpec.contract, events: [] },
      {
        addr: signWalletAddress,
        sk: new Uint8Array(),
      },
      true,
      false,
      true
    ),
  };

  const buildN: Record<string, unknown>[] = [];
  for (const { marketId: syncMarketId } of marketsToSync) {
    const txnO = (
      await builder.lending.sync_user_market_for_price_change(
        userAddress,
        Number(syncMarketId)
      )
    ).obj;
    buildN.push({
      ...txnO,
      note: new TextEncoder().encode(
        `lending sync_user_market_for_price_change ${syncMarketId}`
      ),
      payment: 1e5,
    });
  }

  ci.setFee(10000);
  ci.setEnableGroupResourceSharing(true);
  ci.setExtraTxns(buildN);
  if (marketNetworkId === "algorand-mainnet") {
    ci.setBeaconId(3209233839);
  }

  const customR = await ci.custom();
  if (!customR?.success || !Array.isArray(customR.txns) || customR.txns.length === 0) {
    throw new Error("Failed to build sync transaction group");
  }

  const algorandClients = await algorandService.initializeClientsForTransactions(
    algorandNetwork
  );

  const unsignedB64 = customR.txns as string[];
  const toSign = unsignedB64.map((txn: string) =>
    Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
  );
  const stxns = await signTransactions(toSign);

  const res = await algorandClients.algod.sendRawTransaction(stxns as Uint8Array).do();
  await algosdk.waitForConfirmation(algorandClients.algod, res.txid, 4);

  await updateTransactionMetadata(res.txid, marketNetworkId);

  return {
    txid: res.txid,
    networkId: marketNetworkId,
    marketsSynced: marketsToSync.length,
    poolId: String(poolId),
  };
}
