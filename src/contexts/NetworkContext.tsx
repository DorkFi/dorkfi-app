import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  WalletManager,
  NetworkId,
  WalletId,
  WalletProvider,
} from "@txnlab/use-wallet-react";
import {
  getCurrentNetworkConfig,
  NetworkId as ConfigNetworkId,
  setCurrentNetwork,
  getNetworkConfig,
} from "@/config";

interface NetworkContextType {
  currentNetwork: ConfigNetworkId;
  walletManager: WalletManager;
  switchNetwork: (networkId: ConfigNetworkId) => Promise<void>;
  isSwitchingNetwork: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({
  children,
}) => {
  const [currentNetwork, setCurrentNetworkState] =
    useState<ConfigNetworkId>("voi-mainnet");
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  // Create WalletManager with current network configuration
  const createWalletManager = (networkId: ConfigNetworkId): WalletManager => {
    // First update the global config
    setCurrentNetwork(networkId);

    // Then get the updated config
    const networkConfig = getCurrentNetworkConfig();

    // Determine wallet configuration based on network type
    const wallets = getWalletsForNetwork(networkId);

    return new WalletManager({
      wallets,
      algod: {
        baseServer: networkConfig.rpcUrl,
        port: networkConfig.rpcPort,
        token: networkConfig.rpcToken,
      },
      network: networkConfig.walletNetworkId as NetworkId,
    });
  };

  // Get appropriate wallets for the network type
  const getWalletsForNetwork = (networkId: ConfigNetworkId) => {
    const networkConfig = getNetworkConfig(networkId);

    if (networkConfig.networkType === "avm") {
      // AVM networks (Algorand/VOI) - use Algorand-compatible wallets
      // These wallets work with both VOI and Algorand networks
      const wallets = [
        WalletId.KIBISIS,
        {
          id: WalletId.LUTE,
          options: { siteName: "DorkFi" },
        },
      ];
      // Note: WalletConnect configuration needs proper setup for production use
      // Additional AVM wallets can be added here as they become available
      if (networkId === "voi-mainnet") {
        return [
          WalletId.KIBISIS,
          {
            id: WalletId.LUTE,
            options: { siteName: "DorkFi" },
          },
          {
            id: WalletId.WALLETCONNECT,
            options: {
              projectId: "cd7fe0125d88d239da79fa286e6de2a8",
              metadata: {
                name: "DorkFi",
              },
            },
          }
        ];
      } else if (networkId === "algorand-mainnet") {
        return [
          WalletId.KIBISIS,
          {
            id: WalletId.LUTE,
            options: { siteName: "DorkFi" },
          },
          WalletId.PERA,
          WalletId.DEFLY,
        ];
      }
      return wallets;
    } else if (networkConfig.networkType === "evm") {
      // EVM networks (Ethereum/Base) - for now return empty array
      // EVM wallet integration would be implemented here
      return [];
    }

    return [];
  };

  const [walletManager, setWalletManager] = useState(() =>
    createWalletManager(currentNetwork)
  );

  const switchNetwork = async (networkId: ConfigNetworkId) => {
    if (isSwitchingNetwork) return; // Prevent multiple simultaneous switches

    setIsSwitchingNetwork(true);

    try {
      // Get current wallet state before switching
      const currentActiveWallet = walletManager.activeWallet;
      const wasConnected = currentActiveWallet?.isConnected;

      // Disconnect current wallet if connected
      if (wasConnected && currentActiveWallet) {
        try {
          await currentActiveWallet.disconnect();
        } catch (error) {
          console.warn(
            "Failed to disconnect wallet during network switch:",
            error
          );
          // Continue with network switch even if disconnect fails
        }
      }

      // Update local state
      setCurrentNetworkState(networkId);

      // Create new WalletManager with new network configuration
      const newWalletManager = createWalletManager(networkId);
      setWalletManager(newWalletManager);

      // Note: User will need to reconnect wallet manually after network switch
      // This is intentional to ensure proper wallet state management
    } catch (error) {
      console.error("Failed to switch network:", error);
      throw error;
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  return (
    <NetworkContext.Provider
      value={{
        currentNetwork,
        walletManager,
        switchNetwork,
        isSwitchingNetwork,
      }}
    >
      <WalletProvider manager={walletManager}>{children}</WalletProvider>
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};
