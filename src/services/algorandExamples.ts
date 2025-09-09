/**
 * Algorand Service Usage Examples
 * 
 * This file demonstrates how to use the Algorand service for various operations
 */

import algorandService, { AlgorandNetwork } from '@/services/algorandService';
import { getCurrentNetworkConfig, getAlgorandConfigFromNetworkConfig, isAlgorandCompatibleNetwork } from '@/config';

/**
 * Example: Initialize Algorand clients for current network
 */
export const initializeAlgorandForCurrentNetwork = async () => {
  const networkConfig = getCurrentNetworkConfig();
  
  console.log(networkConfig);

  if (!isAlgorandCompatibleNetwork(networkConfig.networkId)) {
    throw new Error('Current network is not Algorand-compatible');
  }

  const algorandConfig = getAlgorandConfigFromNetworkConfig(networkConfig);
  const clients = algorandService.initializeClients(
    algorandConfig.network as AlgorandNetwork,
    algorandConfig
  );

  return clients;
};

/**
 * Example: Get account information
 */
export const getAccountInfo = async (address: string) => {
  const algod = algorandService.getAlgodClient();
  
  try {
    const accountInfo = await algod.accountInformation(address).do();
    return accountInfo;
  } catch (error) {
    console.error('Failed to get account info:', error);
    throw error;
  }
};

/**
 * Example: Get asset information
 */
export const getAssetInfo = async (assetId: number) => {
  const algod = algorandService.getAlgodClient();
  
  try {
    const assetInfo = await algod.getAssetByID(assetId).do();
    return assetInfo;
  } catch (error) {
    console.error('Failed to get asset info:', error);
    throw error;
  }
};

/**
 * Example: Search transactions using indexer
 */
export const searchTransactions = async (address?: string, assetId?: number, limit = 10) => {
  const indexer = algorandService.getIndexerClient();
  
  try {
    let searchQuery = indexer.searchForTransactions();
    
    if (address) {
      searchQuery = searchQuery.address(address);
    }
    
    if (assetId) {
      searchQuery = searchQuery.assetID(assetId);
    }

    const transactions = await searchQuery.limit(limit).do();
    return transactions;
  } catch (error) {
    console.error('Failed to search transactions:', error);
    throw error;
  }
};

/**
 * Example: Get account transactions
 */
export const getAccountTransactions = async (address: string, limit = 10) => {
  const indexer = algorandService.getIndexerClient();
  
  try {
    const transactions = await indexer.lookupAccountTransactions(address).limit(limit).do();
    return transactions;
  } catch (error) {
    console.error('Failed to get account transactions:', error);
    throw error;
  }
};

/**
 * Example: Get asset transactions
 */
export const getAssetTransactions = async (assetId: number, limit = 10) => {
  const indexer = algorandService.getIndexerClient();
  
  try {
    const transactions = await indexer.lookupAssetTransactions(assetId).limit(limit).do();
    return transactions;
  } catch (error) {
    console.error('Failed to get asset transactions:', error);
    throw error;
  }
};

/**
 * Example: Test network connectivity
 */
export const testNetworkConnectivity = async (network?: AlgorandNetwork) => {
  try {
    const connections = await algorandService.testConnections(network);
    const status = await algorandService.getNetworkStatus(network);
    
    return {
      connections,
      status,
      isHealthy: connections.both,
    };
  } catch (error) {
    console.error('Network connectivity test failed:', error);
    return {
      connections: { algod: false, indexer: false, both: false },
      status: null,
      isHealthy: false,
    };
  }
};

/**
 * Example: Switch between networks
 */
export const switchToNetwork = async (network: AlgorandNetwork) => {
  try {
    const clients = algorandService.switchNetwork(network);
    
    // Test connectivity after switching
    const connections = await algorandService.testConnections();
    
    return {
      clients,
      connections,
      success: connections.both,
    };
  } catch (error) {
    console.error('Failed to switch network:', error);
    throw error;
  }
};

/**
 * Example: Initialize VOI Mainnet clients
 */
export const initializeVOIMainnet = async () => {
  try {
    const clients = algorandService.initializeClients('voimain');
    const connections = await algorandService.testConnections('voimain');
    
    return {
      clients,
      connections,
      success: connections.both,
    };
  } catch (error) {
    console.error('Failed to initialize VOI Mainnet:', error);
    throw error;
  }
};

/**
 * Example: Initialize VOI Testnet clients
 */
export const initializeVOITestnet = async () => {
  try {
    const clients = algorandService.initializeClients('voitest');
    const connections = await algorandService.testConnections('voitest');
    
    return {
      clients,
      connections,
      success: connections.both,
    };
  } catch (error) {
    console.error('Failed to initialize VOI Testnet:', error);
    throw error;
  }
};

/**
 * Example: Get current network information
 */
export const getCurrentNetworkInfo = () => {
  const currentNetwork = algorandService.getCurrentNetwork();
  const config = algorandService.getCurrentConfig();
  const walletNetworkId = algorandService.getCurrentWalletNetworkId();
  const initializedNetworks = algorandService.getInitializedNetworks();
  
  return {
    currentNetwork,
    walletNetworkId,
    config,
    initializedNetworks,
  };
};

/**
 * Example: Get wallet network ID for a specific network
 */
export const getWalletNetworkIdForNetwork = (network: AlgorandNetwork) => {
  return algorandService.getWalletNetworkId(network);
};

/**
 * Example: Get all wallet network IDs
 */
export const getAllWalletNetworkIds = () => {
  const networks = algorandService.getInitializedNetworks();
  const walletNetworkIds: Record<AlgorandNetwork, string> = {} as any;
  
  networks.forEach(network => {
    walletNetworkIds[network] = algorandService.getWalletNetworkId(network);
  });
  
  return walletNetworkIds;
};
