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
  NetworkConfigBuilder,
} from "@txnlab/use-wallet-react";
import {
  getCurrentNetworkConfig,
  NetworkId as ConfigNetworkId,
  setCurrentNetwork,
  getNetworkConfig,
} from "@/config";
import {
  getSavedNetwork,
  saveSelectedNetwork,
} from "@/utils/networkPersistence";

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
  // Initialize with saved network or default to voi-mainnet
  const [currentNetwork, setCurrentNetworkState] = useState<ConfigNetworkId>(
    () => {
      const savedNetwork = getSavedNetwork();
      return savedNetwork || "voi-mainnet";
    }
  );
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  // Create WalletManager with current network configuration
  const createWalletManager = (networkId: ConfigNetworkId): WalletManager => {
    // First update the global config
    setCurrentNetwork(networkId);

    // Then get the updated config
    const networkConfig = getCurrentNetworkConfig();

    const networks = getNetworks();

    // Determine wallet configuration based on network type
    const wallets = getWalletsForNetwork(networkId);

    return new WalletManager({
      wallets,
      networks,
      defaultNetwork: networkConfig.walletNetworkId as NetworkId,
    });
  };

  const getNetworks = () => {
    return new NetworkConfigBuilder()
      .addNetwork("voi-mainnet", {
        algod: {
          token: "",
          baseServer: "https://mainnet-api.voi.nodely.dev",
          port: "",
        },
        isTestnet: false,
        genesisHash: "r20fSQI8gWe/kFZziNonSPCXLwcQmH/nxROvnnueWOk=",
        genesisId: "voimain-v1.0",
        caipChainId: "algorand:r20fSQI8gWe_kFZziNonSPCXLwcQmH_n",
      })
      .build();
  };

  // Get appropriate wallets for the network type
  const getWalletsForNetwork = (networkId: ConfigNetworkId) => {
    const networkConfig = getNetworkConfig(networkId);

    if (networkConfig.networkType === "avm") {
      // Include ALL AVM wallets for ALL AVM networks to prevent disconnection
      // This allows switching to any network without disconnecting the wallet
      return [
        WalletId.KIBISIS,
        {
          id: WalletId.LUTE,
          options: { siteName: "DorkFi" },
        },
        WalletId.PERA,
        {
          id: WalletId.BIATEC,
          options: {
            projectId: "cd7fe0125d88d239da79fa286e6de2a8",
            metadata: {
              name: "DorkFi",
              description: "DorkFi DeFi Protocol",
              url: "https://app.dork.fi",
              icons: ["https://app.dork.fi/favicon.ico"],
            },
            enableExplorer: true,
            explorerRecommendedWalletIds: ["biatec"],
            themeMode: "light",
          },
        },
        {
          id: WalletId.WALLETCONNECT,
          options: {
            projectId: "cd7fe0125d88d239da79fa286e6de2a8",
            metadata: {
              name: "DorkFi",
              description: "DorkFi DeFi Protocol",
              url: "https://app.dork.fi",
              icons: ["https://app.dork.fi/favicon.ico"],
            },
            enableExplorer: true,
            explorerRecommendedWalletIds: ["vera"],
            themeMode: "light",
          },
        },
      ] as any[];
    } else if (networkConfig.networkType === "evm") {
      // EVM networks (Ethereum/Base) - for now return empty array
      // EVM wallet integration would be implemented here
      return [];
    }

    return [];
  };

  const isNetworkSupportedByWallet = (
    networkId: ConfigNetworkId,
    walletId?: string,
    walletName?: string
  ): boolean => {
    if (!walletId) return true; // If no wallet connected, all networks are allowed

    const walletIdLower = walletId.toLowerCase();
    const walletNameLower = (walletName || "").toLowerCase();

    // Universal wallets support all AVM networks
    if (walletIdLower === "lute" || walletIdLower === "kibisis") {
      return true;
    }

    // VOI-specific wallets only support VOI Mainnet
    if (
      walletIdLower === "vera" ||
      walletIdLower === "biatec" ||
      walletNameLower.includes("vera") ||
      walletNameLower.includes("biatec")
    ) {
      return networkId === "voi-mainnet";
    }

    // Algorand-specific wallets only support Algorand Mainnet
    if (
      walletIdLower === "pera" ||
      walletIdLower === "defly" ||
      walletNameLower.includes("pera") ||
      walletNameLower.includes("defly")
    ) {
      return networkId === "algorand-mainnet";
    }

    // WalletConnect - check wallet name for specific restrictions
    if (walletIdLower === "walletconnect") {
      if (
        walletNameLower.includes("vera") ||
        walletNameLower.includes("biatec")
      ) {
        return networkId === "voi-mainnet";
      }
      if (
        walletNameLower.includes("pera") ||
        walletNameLower.includes("defly")
      ) {
        return networkId === "algorand-mainnet";
      }

      // Fallback: If WalletConnect on VOI Mainnet, assume it's a VOI-specific wallet
      // This handles cases where wallet name doesn't contain the specific wallet name
      if (currentNetwork === "voi-mainnet") {
        return networkId === "voi-mainnet";
      }

      // Unknown WalletConnect wallet, allow all networks
      return true;
    }

    // Default: allow all networks for unknown wallet types
    return true;
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

      // Allow switching to any network - no wallet compatibility validation
      // Keep wallet connected during network switches for all wallets
      if (wasConnected) {
        // Update local state
        setCurrentNetworkState(networkId);

        // Save the selected network
        saveSelectedNetwork(networkId);

        // Create new WalletManager with new network configuration
        const newWalletManager = createWalletManager(networkId);
        setWalletManager(newWalletManager);

        // Note: All wallets maintain their connection across network switches
      } else {
        // For when not connected, use standard switching
        setCurrentNetworkState(networkId);

        // Save the selected network
        saveSelectedNetwork(networkId);

        // Create new WalletManager with new network configuration
        const newWalletManager = createWalletManager(networkId);
        setWalletManager(newWalletManager);
      }
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
