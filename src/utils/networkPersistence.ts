import { ConfigNetworkId } from "@/config";

const NETWORK_STORAGE_KEY = 'dorkfi-selected-network';

/**
 * Save the selected network to localStorage
 */
export const saveSelectedNetwork = (networkId: ConfigNetworkId): void => {
  try {
    localStorage.setItem(NETWORK_STORAGE_KEY, networkId);
    console.log('Network saved:', networkId);
  } catch (error) {
    console.warn('Failed to save network:', error);
  }
};

/**
 * Get the saved network from localStorage
 */
export const getSavedNetwork = (): ConfigNetworkId | null => {
  try {
    const saved = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (saved) {
      console.log('Saved network found:', saved);
      return saved as ConfigNetworkId;
    }
    return null;
  } catch (error) {
    console.warn('Failed to get saved network:', error);
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
