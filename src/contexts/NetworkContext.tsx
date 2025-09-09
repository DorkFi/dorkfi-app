import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletManager, NetworkId, WalletId, WalletProvider } from '@txnlab/use-wallet-react';
import { getCurrentNetworkConfig, NetworkId as ConfigNetworkId, setCurrentNetwork } from '@/config';

interface NetworkContextType {
  currentNetwork: ConfigNetworkId;
  walletManager: WalletManager;
  switchNetwork: (networkId: ConfigNetworkId) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [currentNetwork, setCurrentNetworkState] = useState<ConfigNetworkId>('voi-mainnet');
  
  // Create WalletManager with current network configuration
  const createWalletManager = (networkId: ConfigNetworkId): WalletManager => {
    // First update the global config
    setCurrentNetwork(networkId);
    
    // Then get the updated config
    const networkConfig = getCurrentNetworkConfig();
    
    const walletConnectProjectId = "e7b04c22de006e0fc7cef5a00cb7fac9";

    return new WalletManager({
      wallets: [
        WalletId.KIBISIS,
        {
          id: WalletId.LUTE,
          options: { siteName: "DorkFi" },
        },
      ],
      algod: {
        baseServer: networkConfig.rpcUrl,
        port: networkConfig.rpcPort,
        token: networkConfig.rpcToken,
      },
      network: networkConfig.walletNetworkId as NetworkId,
    });
  };

  const [walletManager, setWalletManager] = useState(() => createWalletManager(currentNetwork));

  const switchNetwork = (networkId: ConfigNetworkId) => {
    // Update local state
    setCurrentNetworkState(networkId);
    
    // Create new WalletManager with new network configuration
    const newWalletManager = createWalletManager(networkId);
    setWalletManager(newWalletManager);
  };

  return (
    <NetworkContext.Provider value={{ currentNetwork, walletManager, switchNetwork }}>
      <WalletProvider manager={walletManager}>
        {children}
      </WalletProvider>
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
