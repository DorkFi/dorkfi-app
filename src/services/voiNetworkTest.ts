/**
 * VOI Network Test Examples
 * 
 * This file demonstrates how to test VOI network connectivity
 * using the Algorand service.
 */

import algorandService from '@/services/algorandService';

/**
 * Test VOI Mainnet connectivity
 */
export const testVOIMainnetConnectivity = async () => {
  try {
    console.log('Testing VOI Mainnet connectivity...');
    
    // Initialize VOI Mainnet clients
    const clients = algorandService.initializeClients('voimain');
    console.log('VOI Mainnet clients initialized:', {
      algodServer: clients.config.algodServer,
      indexerServer: clients.config.indexerServer,
    });
    
    // Test connections
    const connections = await algorandService.testConnections('voimain');
    console.log('VOI Mainnet connection test results:', connections);
    
    // Get network status
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
  } catch (error) {
    console.error('VOI Mainnet test failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Test VOI Testnet connectivity
 */
export const testVOITestnetConnectivity = async () => {
  try {
    console.log('Testing VOI Testnet connectivity...');
    
    // Initialize VOI Testnet clients
    const clients = algorandService.initializeClients('voitest');
    console.log('VOI Testnet clients initialized:', {
      algodServer: clients.config.algodServer,
      indexerServer: clients.config.indexerServer,
    });
    
    // Test connections
    const connections = await algorandService.testConnections('voitest');
    console.log('VOI Testnet connection test results:', connections);
    
    // Get network status
    const status = await algorandService.getNetworkStatus('voitest');
    console.log('VOI Testnet status:', {
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
  } catch (error) {
    console.error('VOI Testnet test failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Test all VOI networks
 */
export const testAllVOINetworks = async () => {
  console.log('Testing all VOI networks...');
  
  const results = await Promise.allSettled([
    testVOIMainnetConnectivity(),
    testVOITestnetConnectivity(),
  ]);
  
  const voiMainnetResult = results[0].status === 'fulfilled' ? results[0].value : { success: false, error: results[0].reason };
  const voiTestnetResult = results[1].status === 'fulfilled' ? results[1].value : { success: false, error: results[1].reason };
  
  console.log('All VOI network test results:', {
    voiMainnet: voiMainnetResult,
    voiTestnet: voiTestnetResult,
  });
  
  return {
    voiMainnet: voiMainnetResult,
    voiTestnet: voiTestnetResult,
    allHealthy: voiMainnetResult.success && voiTestnetResult.success,
  };
};

/**
 * Example: Get VOI network information
 */
export const getVOINetworkInfo = () => {
  const voiMainConfig = algorandService.getClients('voimain').config;
  const voiTestConfig = algorandService.getClients('voitest').config;
  
  return {
    voimain: {
      network: voiMainConfig.network,
      walletNetworkId: voiMainConfig.walletNetworkId,
      algodServer: voiMainConfig.algodServer,
      algodPort: voiMainConfig.algodPort,
      indexerServer: voiMainConfig.indexerServer,
      indexerPort: voiMainConfig.indexerPort,
    },
    voitest: {
      network: voiTestConfig.network,
      walletNetworkId: voiTestConfig.walletNetworkId,
      algodServer: voiTestConfig.algodServer,
      algodPort: voiTestConfig.algodPort,
      indexerServer: voiTestConfig.indexerServer,
      indexerPort: voiTestConfig.indexerPort,
    },
  };
};
