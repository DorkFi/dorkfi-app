/**
 * Algorand Service Documentation
 * 
 * The Algorand service provides a centralized way to manage Algorand Algod and Indexer clients
 * across different networks (Mainnet, Testnet, Local, VOI Main, VOI Test).
 * 
 * ## Basic Usage
 * 
 * ```typescript
 * import algorandService from '@/services/algorandService';
 * 
 * // Get clients for current network (defaults to testnet)
 * const { algod, indexer } = algorandService.getCurrentClients();
 * 
 * // Switch to mainnet
 * const mainnetClients = algorandService.switchNetwork('mainnet');
 * 
 * // Switch to VOI Main
 * const voiMainClients = algorandService.switchNetwork('voimain');
 * 
 * // Switch to VOI Test
 * const voiTestClients = algorandService.switchNetwork('voitest');
 * 
 * // Initialize clients for a specific network with custom config
 * const customClients = algorandService.initializeClients('testnet', {
 *   algodServer: 'https://custom-algod-server.com',
 *   indexerServer: 'https://custom-indexer-server.com',
 * });
 * ```
 * 
 * ## Integration with Existing Config
 * 
 * ```typescript
 * import { getCurrentNetworkConfig, getAlgorandConfigFromNetworkConfig } from '@/config';
 * import algorandService from '@/services/algorandService';
 * 
 * // Initialize Algorand clients based on current network config
 * const networkConfig = getCurrentNetworkConfig();
 * const algorandConfig = getAlgorandConfigFromNetworkConfig(networkConfig);
 * const clients = algorandService.initializeClients(
 *   algorandConfig.network,
 *   algorandConfig
 * );
 * ```
 * 
 * ## Common Operations
 * 
 * ```typescript
 * // Get account information
 * const accountInfo = await algorandService.getAlgodClient().accountInformation(address).do();
 * 
 * // Search transactions
 * const transactions = await algorandService.getIndexerClient()
 *   .searchForTransactions({ address, limit: 10 })
 *   .do();
 * 
 * // Test connectivity
 * const { algod, indexer, both } = await algorandService.testConnections();
 * 
 * // Get wallet network ID for use-wallet integration
 * const walletNetworkId = algorandService.getCurrentWalletNetworkId();
 * ```
 * 
 * ## Wallet Integration
 * 
 * ```typescript
 * // Get wallet network ID for current network
 * const currentWalletId = algorandService.getCurrentWalletNetworkId();
 * 
 * // Get wallet network ID for specific network
 * const voiMainWalletId = algorandService.getWalletNetworkId('voimain');
 * 
 * // Use with use-wallet
 * const walletNetworkId = algorandService.getCurrentWalletNetworkId();
 * // Pass walletNetworkId to use-wallet configuration
 * ```
 * 
 * ## Network Management
 * 
 * ```typescript
 * // Check if clients are initialized for a network
 * const hasMainnetClients = algorandService.hasClients('mainnet');
 * 
 * // Get all initialized networks
 * const networks = algorandService.getInitializedNetworks();
 * 
 * // Clear clients for a specific network
 * algorandService.clearClients('testnet');
 * ```
 */
