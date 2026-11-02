import { getNetworkConfig, type NetworkId } from "@/config";

const NETWORK_STORAGE_KEY = "dorkfi-selected-network";

const KNOWN_NETWORKS: readonly NetworkId[] = [
  "voi-mainnet",
  "algorand-mainnet",
  "algorand-testnet",
  "base-mainnet",
  "base-testnet",
  "ethereum-mainnet",
  "ethereum-testnet",
  "localnet",
];

function isConfiguredNetwork(value: string): value is NetworkId {
  if (!(KNOWN_NETWORKS as readonly string[]).includes(value)) return false;
  return Boolean(getNetworkConfig(value as NetworkId));
}

/**
 * Save the selected network to localStorage
 */
export const saveSelectedNetwork = (networkId: NetworkId): void => {
  try {
    localStorage.setItem(NETWORK_STORAGE_KEY, networkId);
    console.log("Network saved:", networkId);
  } catch (error) {
    console.warn("Failed to save network:", error);
  }
};

/**
 * Get the saved network from localStorage
 */
export const getSavedNetwork = (): NetworkId | null => {
  try {
    const saved = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (!saved) return null;
    if (!isConfiguredNetwork(saved)) {
      localStorage.removeItem(NETWORK_STORAGE_KEY);
      console.warn("Cleared invalid saved network:", saved);
      return null;
    }
    console.log("Saved network found:", saved);
    return saved;
  } catch (error) {
    console.warn("Failed to get saved network:", error);
    return null;
  }
};

/**
 * Clear the saved network
 */
export const clearSavedNetwork = (): void => {
  try {
    localStorage.removeItem(NETWORK_STORAGE_KEY);
    console.log('Saved network cleared');
  } catch (error) {
    console.warn('Failed to clear saved network:', error);
  }
};
