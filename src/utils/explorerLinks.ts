import type { NetworkId } from "@/config";
import { getNetworkConfig } from "@/config";

function explorerBase(networkId: NetworkId): string {
  return getNetworkConfig(networkId).explorerUrl.replace(/\/$/, "");
}

/** Asset (ASA / ARC-20 style) page on the configured block explorer for the network. */
export function getExplorerAssetUrl(
  networkId: NetworkId,
  assetId: string
): string {
  const id = String(assetId).trim();
  return `${explorerBase(networkId)}/asset/${id}`;
}

/** Application (smart contract app) page on the configured block explorer. */
export function getExplorerApplicationUrl(
  networkId: NetworkId,
  appId: string
): string {
  const id = String(appId).trim();
  return `${explorerBase(networkId)}/application/${id}`;
}

/** Transaction page on the configured block explorer (path may differ per explorer; AVM explorers use `/tx/{txid}`). */
export function getExplorerTransactionUrl(
  networkId: NetworkId,
  txId: string
): string {
  const id = String(txId).trim();
  return `${explorerBase(networkId)}/tx/${encodeURIComponent(id)}`;
}
