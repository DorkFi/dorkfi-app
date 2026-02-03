/**
 * Utility to determine which networks a wallet supports.
 * Used for showing "switch to supported network" when wallet doesn't support current network.
 */

import { getEnabledNetworks, type NetworkId } from "@/config";

export interface WalletInfo {
  id?: string;
  metadata?: { name?: string };
}

/**
 * Get the list of networks supported by the given wallet.
 * @param wallet - The connected wallet (or null if disconnected)
 * @param currentNetwork - Current network (used for WalletConnect fallback)
 */
export function getSupportedNetworksForWallet(
  wallet: WalletInfo | null | undefined,
  currentNetwork?: NetworkId
): NetworkId[] {
  if (!wallet) {
    return getEnabledNetworks();
  }

  const walletId = (wallet.id || "").toLowerCase();
  const walletName = (wallet.metadata?.name || "").toLowerCase();

  // Universal wallets that work on both VOI and Algorand
  if (
    walletId === "lute" ||
    walletId === "kibisis" ||
    walletId === "vera" ||
    walletId === "biatec" ||
    walletName.includes("vera") ||
    walletName.includes("biatec")
  ) {
    return getEnabledNetworks();
  }

  // Algorand-specific wallets
  if (
    walletId === "pera" ||
    walletId === "defly" ||
    walletName.includes("pera") ||
    walletName.includes("defly")
  ) {
    return ["algorand-mainnet"];
  }

  // WalletConnect - check wallet name for specific restrictions
  if (walletId === "walletconnect") {
    if (walletName.includes("vera") || walletName.includes("biatec")) {
      return ["voi-mainnet"];
    }
    if (walletName.includes("pera") || walletName.includes("defly")) {
      return ["algorand-mainnet"];
    }
    if (currentNetwork === "voi-mainnet") {
      return ["voi-mainnet"];
    }
    return getEnabledNetworks();
  }

  return getEnabledNetworks();
}

/**
 * Check if the current network is supported by the connected wallet.
 */
export function isCurrentNetworkSupportedByWallet(
  wallet: WalletInfo | null | undefined,
  currentNetwork: NetworkId
): boolean {
  const supported = getSupportedNetworksForWallet(wallet, currentNetwork);
  return supported.includes(currentNetwork);
}
