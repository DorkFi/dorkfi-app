/**
 * Example usage of the global configuration system
 * 
 * This file demonstrates how to use the configuration throughout the application
 */

import { 
  getCurrentNetworkConfig, 
  getNetworkConfig, 
  getContractAddress, 
  getLendingPools,
  getLendingPool,
  getCurrentLendingPools,
  getCurrentLendingPool,
  getTokenConfig, 
  getAllTokens,
  isFeatureEnabled,
  getNetworkType,
  isAVMNetwork,
  isEVMNetwork,
  getCurrentNetworkType,
  isCurrentNetworkAVM,
  isCurrentNetworkEVM,
  getAVMNetworks,
  getEVMNetworks,
  type NetworkId,
  type NetworkType 
} from '@/config';

// Example: Get current network configuration
export const getCurrentNetwork = () => {
  const config = getCurrentNetworkConfig();
  console.log('Current network:', config.name);
  console.log('RPC URL:', config.rpcUrl);
  console.log('Explorer URL:', config.explorerUrl);
  return config;
};

// Example: Get lending pool contract address for current network (backward compatibility)
export const getLendingPoolAddress = () => {
  return getCurrentLendingPool();
};

// Example: Get all lending pools for current network
export const getAllLendingPools = () => {
  return getCurrentLendingPools();
};

// Example: Get lending pool contract address for specific network (backward compatibility)
export const getLendingPoolAddressForNetwork = (networkId: NetworkId) => {
  return getLendingPool(networkId);
};

// Example: Get all lending pools for specific network
export const getAllLendingPoolsForNetwork = (networkId: NetworkId) => {
  return getLendingPools(networkId);
};

// Example: Get token configuration
export const getTokenInfo = (symbol: string) => {
  const config = getCurrentNetworkConfig();
  return getTokenConfig(config.networkId, symbol);
};

// Example: Get all available tokens
export const getAvailableTokens = () => {
  const config = getCurrentNetworkConfig();
  return getAllTokens(config.networkId);
};

// Example: Check if feature is enabled
export const canUsePreFi = () => {
  return isFeatureEnabled('enablePreFi');
};

// Example: Switch network configuration
export const switchToTestnet = () => {
  const testnetConfig = getNetworkConfig('voi-testnet');
  console.log('Switched to testnet:', testnetConfig.name);
  return testnetConfig;
};

// Example: Get contract addresses for all contracts
export const getAllContractAddresses = () => {
  const config = getCurrentNetworkConfig();
  return {
    lendingPools: config.contracts.lendingPools,
    priceOracle: config.contracts.priceOracle,
    liquidationEngine: config.contracts.liquidationEngine,
    governance: config.contracts.governance,
    treasury: config.contracts.treasury,
  };
};

// Example: Validate if token exists in current network
export const isValidToken = (symbol: string): boolean => {
  const config = getCurrentNetworkConfig();
  return symbol in config.tokens;
};

// Example: Get token decimals
export const getTokenDecimals = (symbol: string): number => {
  const token = getTokenInfo(symbol);
  return token?.decimals || 6; // Default to 6 decimals
};

// Example: Get token asset ID (for ASA/ARC-200 tokens)
export const getTokenAssetId = (symbol: string): string | undefined => {
  const token = getTokenInfo(symbol);
  return token?.assetId;
};

// Example: Check if token is native
export const isNativeToken = (symbol: string): boolean => {
  const token = getTokenInfo(symbol);
  return !token?.assetId; // Native tokens don't have asset IDs
};

// Example: Check network type
export const checkNetworkType = (networkId: NetworkId): NetworkType => {
  return getNetworkType(networkId);
};

// Example: Check if current network is AVM
export const isCurrentNetworkAVMType = (): boolean => {
  return isCurrentNetworkAVM();
};

// Example: Check if current network is EVM
export const isCurrentNetworkEVMType = (): boolean => {
  return isCurrentNetworkEVM();
};

// Example: Get all AVM networks
export const getAllAVMNetworks = () => {
  const avmNetworks = getAVMNetworks();
  console.log('AVM Networks:', avmNetworks.map(n => n.name));
  return avmNetworks;
};

// Example: Get all EVM networks
export const getAllEVMNetworks = () => {
  const evmNetworks = getEVMNetworks();
  console.log('EVM Networks:', evmNetworks.map(n => n.name));
  return evmNetworks;
};

// Example: Conditional logic based on network type
export const getNetworkSpecificLogic = () => {
  if (isCurrentNetworkAVM()) {
    console.log('Using AVM-specific logic (Algorand/VOI)');
    // Use Algorand SDK, ASA tokens, etc.
    return 'avm';
  } else if (isCurrentNetworkEVM()) {
    console.log('Using EVM-specific logic (Ethereum/Base)');
    // Use ethers.js, ERC-20 tokens, etc.
    return 'evm';
  }
  return 'unknown';
};

// Example: Get appropriate RPC client based on network type
export const getRPCClient = () => {
  const networkType = getCurrentNetworkType();
  
  if (networkType === 'avm') {
    // Return Algorand client
    console.log('Initializing Algorand client');
    return 'algorand-client';
  } else if (networkType === 'evm') {
    // Return Ethereum client
    console.log('Initializing Ethereum client');
    return 'ethereum-client';
  }
  
  throw new Error(`Unsupported network type: ${networkType}`);
};

// Example: Get contract interaction method based on network type
export const getContractInteractionMethod = (contractAddress: string) => {
  const networkType = getCurrentNetworkType();
  
  if (networkType === 'avm') {
    // Use Algorand app calls
    console.log(`Making app call to contract ${contractAddress}`);
    return 'app-call';
  } else if (networkType === 'evm') {
    // Use Ethereum contract calls
    console.log(`Making contract call to ${contractAddress}`);
    return 'contract-call';
  }
  
  throw new Error(`Unsupported network type: ${networkType}`);
};
