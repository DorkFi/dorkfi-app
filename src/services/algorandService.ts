/**
 * Algorand Service - Client management for Algorand blockchain interactions
 *
 * This service provides centralized management of Algorand Algod and Indexer clients
 * with support for multiple networks (Mainnet, Testnet, Local).
 */

import algosdk, { Algodv2, Indexer } from "algosdk";

export type AlgorandNetwork =
  | "mainnet"
  | "testnet"
  | "local"
  | "voimain"
  | "voitest";

export interface AlgorandConfig {
  network: AlgorandNetwork;
  algodToken: string;
  algodServer: string;
  algodPort: number;
  indexerToken: string;
  indexerServer: string;
  indexerPort: number;
}

export interface AlgorandClients {
  algod: Algodv2;
  indexer: Indexer;
  config: AlgorandConfig;
}

// Default configurations for different networks
const NETWORK_CONFIGS: Record<
  AlgorandNetwork,
  Omit<AlgorandConfig, "network">
> = {
  mainnet: {
    algodToken: "",
    algodServer: "https://mainnet-api.algonode.cloud",
    algodPort: 443,
    indexerToken: "",
    indexerServer: "https://mainnet-idx.algonode.cloud",
    indexerPort: 443,
  },
  testnet: {
    algodToken: "",
    algodServer: "https://testnet-api.algonode.cloud",
    algodPort: 443,
    indexerToken: "",
    indexerServer: "https://testnet-idx.algonode.cloud",
    indexerPort: 443,
  },
  local: {
    algodToken:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    algodServer: "http://localhost",
    algodPort: 4001,
    indexerToken:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    indexerServer: "http://localhost",
    indexerPort: 8980,
  },
  voimain: {
    algodToken: "",
    algodServer: "https://mainnet-api.voi.nodely.dev",
    algodPort: 443,
    indexerToken: "",
    indexerServer: "https://mainnet-idx.voi.nodely.dev",
    indexerPort: 443,
  },
  voitest: {
    algodToken: "",
    algodServer: "https://testnet-api.voi.nodely.dev",
    algodPort: 443,
    indexerToken: "",
    indexerServer: "https://testnet-idx.voi.nodely.dev",
    indexerPort: 443,
  },
};

class AlgorandService {
  private clients: Map<AlgorandNetwork, AlgorandClients> = new Map();
  private currentNetwork: AlgorandNetwork = "testnet";

  /**
   * Initialize clients for a specific network
   */
  public initializeClients(
    network: AlgorandNetwork,
    customConfig?: Partial<AlgorandConfig>
  ): AlgorandClients {
    const baseConfig = NETWORK_CONFIGS[network];
    const config: AlgorandConfig = {
      network,
      ...baseConfig,
      ...customConfig,
    };

    // Create Algod client
    const algod = new Algodv2(
      config.algodToken,
      config.algodServer,
      config.algodPort
    );

    // Create Indexer client
    const indexer = new Indexer(
      config.indexerToken,
      config.indexerServer,
      config.indexerPort
    );

    const clients: AlgorandClients = {
      algod,
      indexer,
      config,
    };

    this.clients.set(network, clients);
    this.currentNetwork = network;

    return clients;
  }

  /**
   * Get clients for the current network
   */
  public getCurrentClients(): AlgorandClients {
    const clients = this.clients.get(this.currentNetwork);
    if (!clients) {
      throw new Error(
        `No clients initialized for network: ${this.currentNetwork}`
      );
    }
    return clients;
  }

  /**
   * Get clients for a specific network
   */
  public getClients(network: AlgorandNetwork): AlgorandClients {
    const clients = this.clients.get(network);
    if (!clients) {
      // Auto-initialize if not exists
      return this.initializeClients(network);
    }
    return clients;
  }

  /**
   * Switch to a different network
   */
  public switchNetwork(network: AlgorandNetwork): AlgorandClients {
    this.currentNetwork = network;
    return this.getCurrentClients();
  }

  /**
   * Get the current network
   */
  public getCurrentNetwork(): AlgorandNetwork {
    return this.currentNetwork;
  }

  /**
   * Get Algod client for current network
   */
  public getAlgodClient(): Algodv2 {
    return this.getCurrentClients().algod;
  }

  /**
   * Get Indexer client for current network
   */
  public getIndexerClient(): Indexer {
    return this.getCurrentClients().indexer;
  }

  /**
   * Get network configuration for current network
   */
  public getCurrentConfig(): AlgorandConfig {
    return this.getCurrentClients().config;
  }

  /**
   * Check if clients are initialized for a network
   */
  public hasClients(network: AlgorandNetwork): boolean {
    return this.clients.has(network);
  }

  /**
   * Get all initialized networks
   */
  public getInitializedNetworks(): AlgorandNetwork[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Clear clients for a specific network
   */
  public clearClients(network: AlgorandNetwork): void {
    this.clients.delete(network);
  }

  /**
   * Clear all clients
   */
  public clearAllClients(): void {
    this.clients.clear();
  }

  /**
   * Test connection to Algod
   */
  public async testAlgodConnection(
    network?: AlgorandNetwork
  ): Promise<boolean> {
    try {
      const clients = network
        ? this.getClients(network)
        : this.getCurrentClients();
      const status = await clients.algod.status().do();
      return status !== null;
    } catch (error) {
      console.error("Algod connection test failed:", error);
      return false;
    }
  }

  /**
   * Test connection to Indexer
   */
  public async testIndexerConnection(
    network?: AlgorandNetwork
  ): Promise<boolean> {
    try {
      const clients = network
        ? this.getClients(network)
        : this.getCurrentClients();
      const health = await clients.indexer.makeHealthCheck().do();
      return health !== null;
    } catch (error) {
      console.error("Indexer connection test failed:", error);
      return false;
    }
  }

  /**
   * Test both connections
   */
  public async testConnections(network?: AlgorandNetwork): Promise<{
    algod: boolean;
    indexer: boolean;
    both: boolean;
  }> {
    const [algod, indexer] = await Promise.all([
      this.testAlgodConnection(network),
      this.testIndexerConnection(network),
    ]);

    return {
      algod,
      indexer,
      both: algod && indexer,
    };
  }

  /**
   * Get network status information
   */
  public async getNetworkStatus(network?: AlgorandNetwork): Promise<{
    network: AlgorandNetwork;
    algodStatus: any;
    indexerHealth: any;
    connections: { algod: boolean; indexer: boolean; both: boolean };
  }> {
    const clients = network
      ? this.getClients(network)
      : this.getCurrentClients();
    const currentNetwork = network || this.currentNetwork;

    try {
      const [algodStatus, indexerHealth, connections] = await Promise.all([
        clients.algod.status().do(),
        clients.indexer.makeHealthCheck().do(),
        this.testConnections(currentNetwork),
      ]);

      return {
        network: currentNetwork,
        algodStatus,
        indexerHealth,
        connections,
      };
    } catch (error) {
      console.error("Failed to get network status:", error);
      throw error;
    }
  }
}

// Create singleton instance
const algorandService = new AlgorandService();

// Initialize with testnet by default
algorandService.initializeClients("testnet");

export default algorandService;

// Export utility functions for convenience
export const {
  initializeClients,
  getCurrentClients,
  getClients,
  switchNetwork,
  getCurrentNetwork,
  getAlgodClient,
  getIndexerClient,
  getCurrentConfig,
  hasClients,
  getInitializedNetworks,
  clearClients,
  clearAllClients,
  testAlgodConnection,
  testIndexerConnection,
  testConnections,
  getNetworkStatus,
} = algorandService;

// Export types and constants
export { NETWORK_CONFIGS };
