import { createContext, useContext } from "react";
import type { WalletManager } from "@txnlab/use-wallet-react";

/** Mirrors `@/config` `NetworkId` so this module never imports config (Vite HMR). */
type ConfigNetworkId =
  | "voi-mainnet"
  | "algorand-mainnet"
  | "algorand-testnet"
  | "base-mainnet"
  | "base-testnet"
  | "ethereum-mainnet"
  | "ethereum-testnet"
  | "localnet";

export interface NetworkContextType {
  currentNetwork: ConfigNetworkId;
  walletManager: WalletManager;
  switchNetwork: (networkId: ConfigNetworkId) => Promise<void>;
  isSwitchingNetwork: boolean;
}

export const NetworkContext = createContext<NetworkContextType | undefined>(
  undefined
);

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
};
