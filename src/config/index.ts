/**
 * Global Configuration for DorkFi Protocol
 *
 * This file contains network-specific configurations, contract addresses,
 * and other global settings used throughout the application.
 */

export type NetworkId =
  | "voi-mainnet"
  | "voi-testnet"
  | "algorand-mainnet"
  | "algorand-testnet"
  | "base-mainnet"
  | "base-testnet"
  | "ethereum-mainnet"
  | "ethereum-testnet"
  | "localnet";

export type NetworkType = "avm" | "evm";

export interface ContractConfig {
  lendingPool: string;
  priceOracle?: string;
  liquidationEngine?: string;
  governance?: string;
  treasury?: string;
  // Add more contracts as needed
}

export interface NetworkConfig {
  networkId: NetworkId;
  walletNetworkId: string;
  name: string;
  networkType: NetworkType;
  rpcUrl: string;
  rpcPort?: number;
  rpcToken?: string;
  indexerUrl: string;
  explorerUrl: string;
  contracts: ContractConfig;
  tokens: {
    [symbol: string]: {
      assetId?: string;
      decimals: number;
      name: string;
      symbol: string;
      logoPath: string;
    };
  };
}

export interface GlobalConfig {
  networks: {
    [K in NetworkId]: NetworkConfig;
  };
  defaultNetwork: NetworkId;
  enabledNetworks: NetworkId[];
  version: string;
  features: {
    enablePreFi: boolean;
    enableLiquidations: boolean;
    enableSwap: boolean;
    enableGovernance: boolean;
  };
}

/**
 * VOI Mainnet Configuration
 */
const voiMainnetConfig: NetworkConfig = {
  networkId: "voi-mainnet",
  walletNetworkId: "voimain",
  name: "VOI Mainnet",
  networkType: "avm",
  rpcUrl: "https://mainnet-api.voi.nodely.dev",
  rpcPort: 443,
  rpcToken: "",
  indexerUrl: "https://mainnet-idx.voi.nodely.dev",
  explorerUrl: "https://voi.observer",
  contracts: {
    lendingPool: "41760711",
    // Add other contract IDs as they become available
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    VOI: {
      assetId: undefined, // Native token
      decimals: 6,
      name: "VOI",
      symbol: "VOI",
      logoPath: "/lovable-uploads/VOI.png",
    },
    USDC: {
      assetId: "ASA_ID_aUSD", // TODO: Replace with actual ASA ID
      decimals: 6,
      name: "Aramid USDC",
      symbol: "USDC",
      logoPath: "/lovable-uploads/aUSDC.png",
    },
    UNIT: {
      assetId: "ARC200_ID_UNIT", // TODO: Replace with actual ARC-200 ID
      decimals: 6,
      name: "UNIT",
      symbol: "UNIT",
      logoPath: "/lovable-uploads/UNIT.png",
    },
    BTC: {
      assetId: "ARC200_ID_WBTC", // TODO: Replace with actual ARC-200 ID
      decimals: 8,
      name: "Wrapped BTC",
      symbol: "BTC",
      logoPath: "/lovable-uploads/WrappedBTC.png",
    },
    cbBTC: {
      assetId: "ARC200_ID_cbBTC", // TODO: Replace with actual ARC-200 ID
      decimals: 8,
      name: "Coinbase BTC",
      symbol: "cbBTC",
      logoPath: "/lovable-uploads/cbBTC.png",
    },
    ETH: {
      assetId: "ARC200_ID_WETH", // TODO: Replace with actual ARC-200 ID
      decimals: 8,
      name: "Wrapped ETH",
      symbol: "ETH",
      logoPath: "/lovable-uploads/ETH.jpg",
    },
    ALGO: {
      assetId: "ASA_ID_ALGO_WRAPPED", // TODO: Replace with actual ASA ID
      decimals: 6,
      name: "Algorand",
      symbol: "ALGO",
      logoPath: "/lovable-uploads/Algo.webp",
    },
    POW: {
      assetId: "ARC200_ID_POW", // TODO: Replace with actual ARC-200 ID
      decimals: 6,
      name: "POW",
      symbol: "POW",
      logoPath: "/lovable-uploads/POW.png",
    },
  },
};

/**
 * VOI Testnet Configuration
 */
const voiTestnetConfig: NetworkConfig = {
  networkId: "voi-testnet",
  walletNetworkId: "voitest",
  name: "VOI Testnet",
  networkType: "avm",
  rpcUrl: "https://testnet-idx.voi.nodely.dev",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://testnet-idx.voi.nodely.dev",
  explorerUrl: "https://testnet.voi.observer",
  contracts: {
    lendingPool: "TESTNET_LENDING_POOL_ID", // TODO: Replace with actual testnet contract ID
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    VOI: {
      assetId: undefined, // Native token
      decimals: 6,
      name: "VOI",
      symbol: "VOI",
      logoPath: "/lovable-uploads/VOI.png",
    },
    // Add testnet-specific tokens as needed
  },
};

/**
 * Algorand Mainnet Configuration (for reference)
 */
const algorandMainnetConfig: NetworkConfig = {
  networkId: "algorand-mainnet",
  walletNetworkId: "mainnet",
  name: "Algorand Mainnet",
  networkType: "avm",
  rpcUrl: "https://mainnet-api.algonode.cloud",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://mainnet-idx.algonode.cloud",
  explorerUrl: "https://algoexplorer.io",
  contracts: {
    lendingPool: "ALGORAND_LENDING_POOL_ID", // TODO: Replace with actual contract ID
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    ALGO: {
      assetId: undefined, // Native token
      decimals: 6,
      name: "Algorand",
      symbol: "ALGO",
      logoPath: "/lovable-uploads/Algo.webp",
    },
  },
};

/**
 * Algorand Testnet Configuration (for reference)
 */
const algorandTestnetConfig: NetworkConfig = {
  networkId: "algorand-testnet",
  walletNetworkId: "testnet",
  name: "Algorand Testnet",
  networkType: "avm",
  rpcUrl: "https://testnet-api.algonode.cloud",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://testnet-idx.algonode.cloud",
  explorerUrl: "https://testnet.algoexplorer.io",
  contracts: {
    lendingPool: "ALGORAND_TESTNET_LENDING_POOL_ID", // TODO: Replace with actual contract ID
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    ALGO: {
      assetId: undefined, // Native token
      decimals: 6,
      name: "Algorand",
      symbol: "ALGO",
      logoPath: "/lovable-uploads/Algo.webp",
    },
  },
};

/**
 * Base Mainnet Configuration (EVM)
 */
const baseMainnetConfig: NetworkConfig = {
  networkId: "base-mainnet",
  walletNetworkId: "base-mainnet",
  name: "Base Mainnet",
  networkType: "evm",
  rpcUrl: "https://mainnet.base.org",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://base-mainnet.g.alchemy.com/v2/demo", // Using Alchemy as indexer
  explorerUrl: "https://basescan.org",
  contracts: {
    lendingPool: "0x1234567890123456789012345678901234567890", // TODO: Replace with actual contract address
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    ETH: {
      assetId: undefined, // Native token
      decimals: 18,
      name: "Ethereum",
      symbol: "ETH",
      logoPath: "/lovable-uploads/ETH.jpg",
    },
    USDC: {
      assetId: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
      decimals: 6,
      name: "USD Coin",
      symbol: "USDC",
      logoPath: "/lovable-uploads/aUSDC.png",
    },
  },
};

/**
 * Base Testnet Configuration (EVM)
 */
const baseTestnetConfig: NetworkConfig = {
  networkId: "base-testnet",
  walletNetworkId: "base-testnet",
  name: "Base Testnet",
  networkType: "evm",
  rpcUrl: "https://sepolia.base.org",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://base-sepolia.g.alchemy.com/v2/demo",
  explorerUrl: "https://sepolia.basescan.org",
  contracts: {
    lendingPool: "0x1234567890123456789012345678901234567890", // TODO: Replace with actual testnet contract address
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    ETH: {
      assetId: undefined, // Native token
      decimals: 18,
      name: "Ethereum",
      symbol: "ETH",
      logoPath: "/lovable-uploads/ETH.jpg",
    },
  },
};

/**
 * Ethereum Mainnet Configuration (EVM)
 */
const ethereumMainnetConfig: NetworkConfig = {
  networkId: "ethereum-mainnet",
  walletNetworkId: "ethereum-mainnet",
  name: "Ethereum Mainnet",
  networkType: "evm",
  rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/demo",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://eth-mainnet.g.alchemy.com/v2/demo",
  explorerUrl: "https://etherscan.io",
  contracts: {
    lendingPool: "0x1234567890123456789012345678901234567890", // TODO: Replace with actual contract address
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    ETH: {
      assetId: undefined, // Native token
      decimals: 18,
      name: "Ethereum",
      symbol: "ETH",
      logoPath: "/lovable-uploads/ETH.jpg",
    },
    USDC: {
      assetId: "0xA0b86a33E6441b8c4C8C0e4A0b86a33E6441b8c4C", // Ethereum USDC
      decimals: 6,
      name: "USD Coin",
      symbol: "USDC",
      logoPath: "/lovable-uploads/aUSDC.png",
    },
  },
};

/**
 * Ethereum Testnet Configuration (EVM)
 */
const ethereumTestnetConfig: NetworkConfig = {
  networkId: "ethereum-testnet",
  walletNetworkId: "ethereum-testnet",
  name: "Ethereum Sepolia",
  networkType: "evm",
  rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/demo",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://eth-sepolia.g.alchemy.com/v2/demo",
  explorerUrl: "https://sepolia.etherscan.io",
  contracts: {
    lendingPool: "0x1234567890123456789012345678901234567890", // TODO: Replace with actual testnet contract address
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    ETH: {
      assetId: undefined, // Native token
      decimals: 18,
      name: "Ethereum",
      symbol: "ETH",
      logoPath: "/lovable-uploads/ETH.jpg",
    },
  },
};

/**
 * Localnet Configuration (for local development)
 */
const localnetConfig: NetworkConfig = {
  networkId: "localnet",
  walletNetworkId: "local",
  name: "Local Development Network",
  networkType: "avm",
  rpcUrl: "http://localhost:8080",
  rpcPort: 8080,
  rpcToken: undefined, // Local development, no token required
  indexerUrl: "http://localhost:8980",
  explorerUrl: "http://localhost:3000",
  contracts: {
    lendingPool: "LOCAL_LENDING_POOL_ID", // TODO: Replace with actual local contract ID
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    ALGO: {
      assetId: undefined, // Native token
      decimals: 6,
      name: "Algorand",
      symbol: "ALGO",
      logoPath: "/lovable-uploads/Algo.webp",
    },
    VOI: {
      assetId: undefined, // Native token
      decimals: 6,
      name: "VOI",
      symbol: "VOI",
      logoPath: "/lovable-uploads/VOI.png",
    },
  },
};

/**
 * Global Configuration Object
 */
export const config: GlobalConfig = {
  networks: {
    "voi-mainnet": voiMainnetConfig,
    "voi-testnet": voiTestnetConfig,
    "algorand-mainnet": algorandMainnetConfig,
    "algorand-testnet": algorandTestnetConfig,
    "base-mainnet": baseMainnetConfig,
    "base-testnet": baseTestnetConfig,
    "ethereum-mainnet": ethereumMainnetConfig,
    "ethereum-testnet": ethereumTestnetConfig,
    localnet: localnetConfig,
  },
  defaultNetwork: "voi-mainnet",
  enabledNetworks: ["voi-mainnet", "algorand-mainnet", "base-mainnet"],
  version: "1.0.0",
  features: {
    enablePreFi: true,
    enableLiquidations: true,
    enableSwap: true,
    enableGovernance: false, // Disabled until governance contracts are deployed
  },
};

/**
 * Helper functions for accessing configuration
 */
export const getNetworkConfig = (networkId: NetworkId): NetworkConfig => {
  return config.networks[networkId];
};

export const getCurrentNetworkConfig = (): NetworkConfig => {
  return config.networks[config.defaultNetwork];
};

/**
 * Update the current network
 * This function updates the defaultNetwork in the config
 */
export const setCurrentNetwork = (networkId: NetworkId): void => {
  if (!config.networks[networkId]) {
    throw new Error(`Network ${networkId} is not configured`);
  }
  config.defaultNetwork = networkId;
};

export const getWalletNetworkId = (networkId: NetworkId): string => {
  return config.networks[networkId].walletNetworkId;
};

export const getCurrentWalletNetworkId = (): string => {
  return config.networks[config.defaultNetwork].walletNetworkId;
};

export const getRpcPort = (networkId: NetworkId): number | undefined => {
  return config.networks[networkId].rpcPort;
};

export const getRpcToken = (networkId: NetworkId): string | undefined => {
  return config.networks[networkId].rpcToken;
};

export const getCurrentRpcPort = (): number | undefined => {
  return getRpcPort(config.defaultNetwork);
};

export const getCurrentRpcToken = (): string | undefined => {
  return getRpcToken(config.defaultNetwork);
};

export const getRpcConfig = (networkId: NetworkId) => {
  const networkConfig = config.networks[networkId];
  return {
    url: networkConfig.rpcUrl,
    port: networkConfig.rpcPort,
    token: networkConfig.rpcToken,
  };
};

export const getCurrentRpcConfig = () => {
  return getRpcConfig(config.defaultNetwork);
};

export const getEnabledNetworks = (): NetworkId[] => {
  return config.enabledNetworks;
};

export const getEnabledNetworkConfigs = (): NetworkConfig[] => {
  return config.enabledNetworks.map((networkId) => config.networks[networkId]);
};

export const isNetworkEnabled = (networkId: NetworkId): boolean => {
  return config.enabledNetworks.includes(networkId);
};

export const getContractAddress = (
  networkId: NetworkId,
  contractName: keyof ContractConfig
): string | undefined => {
  return config.networks[networkId].contracts[contractName];
};

export const getTokenConfig = (networkId: NetworkId, symbol: string) => {
  return config.networks[networkId].tokens[symbol];
};

export const getAllTokens = (networkId: NetworkId) => {
  return Object.values(config.networks[networkId].tokens);
};

export const isFeatureEnabled = (
  feature: keyof GlobalConfig["features"]
): boolean => {
  return config.features[feature];
};

/**
 * Network type helper functions
 */
export const getNetworkType = (networkId: NetworkId): NetworkType => {
  return config.networks[networkId].networkType;
};

export const isAVMNetwork = (networkId: NetworkId): boolean => {
  return getNetworkType(networkId) === "avm";
};

export const isEVMNetwork = (networkId: NetworkId): boolean => {
  return getNetworkType(networkId) === "evm";
};

export const getCurrentNetworkType = (): NetworkType => {
  return getCurrentNetworkConfig().networkType;
};

export const isCurrentNetworkAVM = (): boolean => {
  return getCurrentNetworkType() === "avm";
};

export const isCurrentNetworkEVM = (): boolean => {
  return getCurrentNetworkType() === "evm";
};

/**
 * Get all networks of a specific type
 */
export const getNetworksByType = (
  networkType: NetworkType
): NetworkConfig[] => {
  return Object.values(config.networks).filter(
    (network) => network.networkType === networkType
  );
};

export const getAVMNetworks = (): NetworkConfig[] => {
  return getNetworksByType("avm");
};

export const getEVMNetworks = (): NetworkConfig[] => {
  return getNetworksByType("evm");
};

/**
 * Environment-specific overrides
 */
export const getEnvironmentConfig = (): Partial<GlobalConfig> => {
  const env = process.env.NODE_ENV;

  if (env === "development") {
    return {
      defaultNetwork: "voi-testnet", // Use testnet in development
      features: {
        ...config.features,
        enableGovernance: true, // Enable governance in development for testing
      },
    };
  }

  if (env === "test") {
    return {
      defaultNetwork: "voi-testnet",
      features: {
        ...config.features,
        enablePreFi: false, // Disable PreFi in tests
      },
    };
  }

  return {}; // No overrides for production
};

/**
 * Merge environment config with base config
 */
export const getConfig = (): GlobalConfig => {
  const envConfig = getEnvironmentConfig();
  return {
    ...config,
    ...envConfig,
    features: {
      ...config.features,
      ...envConfig.features,
    },
  };
};

/**
 * Algorand Service Integration
 * Helper functions to convert between network config and Algorand service format
 */
export const getAlgorandNetworkFromNetworkId = (
  networkId: NetworkId
): "mainnet" | "testnet" | "local" | "voimain" | "voitest" | null => {
  switch (networkId) {
    case "algorand-mainnet":
      return "mainnet";
    case "algorand-testnet":
      return "testnet";
    case "voi-mainnet":
      return "voimain";
    case "voi-testnet":
      return "voitest";
    case "localnet":
      return "local";
    default:
      return null;
  }
};

export const getAlgorandConfigFromNetworkConfig = (
  networkConfig: NetworkConfig
) => {
  const algorandNetwork = getAlgorandNetworkFromNetworkId(
    networkConfig.networkId
  );
  if (!algorandNetwork) {
    throw new Error(
      `Network ${networkConfig.networkId} is not an Algorand-compatible network`
    );
  }

  // Extract server and port from RPC URL
  const rpcUrl = networkConfig.rpcUrl;
  const indexerUrl = networkConfig.indexerUrl;

  // Parse server from URL (remove protocol)
  const algodServer = rpcUrl.replace(/^https?:\/\//, "").split(":")[0];
  const indexerServer = indexerUrl.replace(/^https?:\/\//, "").split(":")[0];

  // Use configured port or derive from URL
  const algodPort =
    networkConfig.rpcPort ?? (rpcUrl.includes("https") ? 443 : 80);
  const indexerPort = networkConfig.indexerUrl.includes("https") ? 443 : 80;

  return {
    network: algorandNetwork,
    algodToken: networkConfig.rpcToken ?? "", // Use configured token or empty string
    algodServer,
    algodPort,
    indexerToken: "", // Indexer tokens not currently configured
    indexerServer,
    indexerPort,
  };
};

export const isAlgorandCompatibleNetwork = (networkId: NetworkId): boolean => {
  return getAlgorandNetworkFromNetworkId(networkId) !== null;
};

export const isCurrentNetworkAlgorandCompatible = (): boolean => {
  return isAlgorandCompatibleNetwork(config.defaultNetwork);
};

/**
 * Get Algorand configuration for the current network
 */
export const getCurrentAlgorandConfig = () => {
  const currentConfig = getCurrentNetworkConfig();
  return getAlgorandConfigFromNetworkConfig(currentConfig);
};

/**
 * Initialize Algorand clients for the current network
 * This function bridges the gap between our network config and Algorand service
 */
export const initializeAlgorandForCurrentNetwork = async () => {
  const algorandConfig = getCurrentAlgorandConfig();

  // Import AlgorandService functions dynamically to avoid circular dependencies
  const { initializeClients } = await import("@/services/algorandService");

  return initializeClients(algorandConfig.network, algorandConfig);
};

export default config;
