/**
 * VOI Network connectivity examples (VOI Mainnet).
 */

import algorandService from '@/services/algorandService';

/**
 * Test VOI Mainnet connectivity
 */
export const testVOIMainnetConnectivity = async () => {
  try {
    console.log('Testing VOI Mainnet connectivity...');

    const clients = algorandService.initializeClients('voimain');
    console.log('VOI Mainnet clients initialized:', {
      algodServer: clients.config.algodServer,
      indexerServer: clients.config.indexerServer,
    });

    const connections = await algorandService.testConnections('voimain');
    console.log('VOI Mainnet connection test results:', connections);

    const status = await algorandService.getNetworkStatus('voimain');
    console.log('VOI Mainnet status:', {
      network: status.network,
      algodConnected: status.connections.algod,
      indexerConnected: status.connections.indexer,
      bothConnected: status.connections.both,
    });

    return {
      success: connections.both,
      connections,
      status,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('VOI Mainnet test failed:', error);
    return {
      success: false,
      error: message,
    };
  }
};

/**
 * Run VOI Mainnet connectivity check
 */
export const testAllVOINetworks = async () => {
  console.log('Testing VOI Mainnet...');
  const result = await testVOIMainnetConnectivity();
  console.log('VOI Mainnet test result:', result);
  return {
    voiMainnet: result,
    allHealthy: result.success === true,
  };
};

/**
 * Example: VOI Mainnet client configuration from the Algorand service
 */
export const getVOINetworkInfo = () => {
  const voiMainConfig = algorandService.getClients('voimain').config;

  return {
    voimain: {
      network: voiMainConfig.network,
      algodServer: voiMainConfig.algodServer,
      algodPort: voiMainConfig.algodPort,
      indexerServer: voiMainConfig.indexerServer,
      indexerPort: voiMainConfig.indexerPort,
    },
  };
};
