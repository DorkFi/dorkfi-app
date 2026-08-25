import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
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
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";

interface NetworkContextType {
  currentNetwork: ConfigNetworkId;
  walletManager: WalletManager;
  switchNetwork: (networkId: ConfigNetworkId) => Promise<void>;
  isSwitchingNetwork: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

/**
 * Wraps children with WalletUIProvider after a dynamic import so SimplFi
 * (consumer copy) never loads RainbowKit on first paint.
 */
function PrefiWalletUI({
  children,
  enableXchainWagmi,
}: {
  children: ReactNode;
  enableXchainWagmi: boolean;
}) {
  const consumerCopy = useConsumerCopy();
  const [Gate, setGate] = useState<ComponentType<{
    children: ReactNode;
    enableXchainWagmi?: boolean;
  }> | null>(null);

  useEffect(() => {
    if (consumerCopy) return;
    let cancelled = false;
    void import("./XchainPrefiWalletUI").then((mod) => {
      if (!cancelled) setGate(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [consumerCopy]);

  if (consumerCopy || !Gate) {
    return children;
  }
  return <Gate enableXchainWagmi={enableXchainWagmi}>{children}</Gate>;
}

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({
  children,
}) => {
  const consumerCopy = useConsumerCopy();
  // SimplFi hides the network picker; DorkFi's saved chain (e.g. Voi) would
  // make Easy Start Algorand balances look empty. Always pin consumer to mainnet.
  const [currentNetwork, setCurrentNetworkState] = useState<ConfigNetworkId>(
    () => {
      if (consumerCopy) return "algorand-mainnet";
      const savedNetwork = getSavedNetwork();
      return savedNetwork || "algorand-mainnet";
    }
  );
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [rainbowKitWallet, setRainbowKitWallet] = useState<unknown | null>(null);

  useEffect(() => {
    if (consumerCopy) return;
    let cancelled = false;
    void import("@/wallet/xchainWagmiConfig").then(({ xchainWagmiConfig }) => {
      if (cancelled) return;
      setRainbowKitWallet({
        id: WalletId.RAINBOWKIT,
        options: { wagmiConfig: xchainWagmiConfig },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [consumerCopy]);

  // Create WalletManager with current network configuration
  const createWalletManager = (networkId: ConfigNetworkId): WalletManager => {
    try {
      // First update the global config
      setCurrentNetwork(networkId);

      // Then get the updated config
      const networkConfig = getCurrentNetworkConfig();

      // Validate network config exists
      if (!networkConfig) {
        throw new Error(`Network configuration not found for ${networkId}`);
      }

      // Validate walletNetworkId exists
      if (!networkConfig.walletNetworkId) {
        throw new Error(`walletNetworkId not found in network config for ${networkId}`);
      }

      const networks = getNetworks();

      // Determine wallet configuration based on network type
      const wallets = getWalletsForNetwork(networkId);

      // Get the wallet network ID - this should match one of the network IDs in the networks array
      const walletNetworkId = networkConfig.walletNetworkId as NetworkId;

      // Log for debugging
      console.log(`Creating WalletManager for networkId: ${networkId}, walletNetworkId: ${walletNetworkId}`);
      console.log(`Available networks:`, networks);

      return new WalletManager({
        wallets,
        networks,
        defaultNetwork: walletNetworkId,
      });
    } catch (error) {
      console.error(`Error creating WalletManager for ${networkId}:`, error);
      throw error;
    }
  };

  const getNetworks = () => {
    // Voi chain config for @txnlab/use-wallet. Register both IDs: the stack historically
    // used "voimain" (matches app `walletNetworkId`), while persisted wallet state may use
    // the app chain id "voi-mainnet" as activeNetwork — without both, WalletManager throws
    // `Network "voi-mainnet" not found in network configuration`.
    const voiMainnetWalletConfig = {
      algod: {
        token: "",
        baseServer: "https://mainnet-api.voi.dork.fi",
        port: "443",
      },
      isTestnet: false,
      genesisHash: "r20fSQI8gWe/kFZziNonSPCXLwcQmH/nxROvnnueWOk=",
      genesisId: "voimain-v1.0",
      caipChainId: "algorand:r20fSQI8gWe_kFZziNonSPCXLwcQmH_n",
    } as const;

    return new NetworkConfigBuilder()
      .mainnet({
        algod: {
          baseServer: "https://mainnet-api.4160.nodely.dev",
          port: "443",
          token: "",
        },
      })
      .addNetwork("voimain", { ...voiMainnetWalletConfig })
      .addNetwork("voi-mainnet", { ...voiMainnetWalletConfig })
      .build();
  };

  // Get appropriate wallets for the network type
  const getWalletsForNetwork = (networkId: ConfigNetworkId) => {
    const networkConfig = getNetworkConfig(networkId);

    if (networkConfig.networkType === "avm") {
      // Include ALL AVM wallets for ALL AVM networks to prevent disconnection
      // This allows switching to any network without disconnecting the wallet
      const avmWallets: unknown[] = [
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
      ];
      // xChain (RainbowKit / EVM) — Algorand Mainnet only until Voi LogicSig support is confirmed.
      // Skip on SimplFi: Easy Start uses Privy, and RainbowKit's static graph blocked first paint.
      if (networkId === "algorand-mainnet" && !consumerCopy && rainbowKitWallet) {
        avmWallets.unshift(rainbowKitWallet);
      }
      return avmWallets as any[];
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

    // xChain (RainbowKit): Algorand Mainnet only (see XCHAIN_ACCOUNTS_INTEGRATION_PLAN.md)
    if (walletIdLower === "rainbowkit") {
      return networkId === "algorand-mainnet";
    }

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

  useEffect(() => {
    if (consumerCopy || !rainbowKitWallet) return;
    setWalletManager(createWalletManager(currentNetwork));
    // Recreate once RainbowKit config is available (DorkFi xChain wallet).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rainbowKitWallet]);

  useEffect(() => {
    if (!consumerCopy || currentNetwork === "algorand-mainnet") return;
    setCurrentNetwork("algorand-mainnet");
    setCurrentNetworkState("algorand-mainnet");
    setWalletManager(createWalletManager("algorand-mainnet"));
  }, [consumerCopy, currentNetwork]);

  const switchNetwork = async (networkId: ConfigNetworkId) => {
    if (consumerCopy && networkId !== "algorand-mainnet") {
      return;
    }
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
      <WalletProvider manager={walletManager}>
        <PrefiWalletUI enableXchainWagmi={currentNetwork === "algorand-mainnet"}>
          {children}
        </PrefiWalletUI>
      </WalletProvider>
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
