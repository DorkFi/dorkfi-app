import { getDefaultConfig } from "@txnlab/use-wallet-ui-react/rainbowkit";
import { algorandChain } from "algo-x-evm-sdk";

/** WalletConnect Cloud project id for RainbowKit (xChain / EVM). */
const walletConnectProjectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ??
  "cd7fe0125d88d239da79fa286e6de2a8";

/**
 * Shared wagmi config for xChain (RainbowKit). Used on Algorand Mainnet only
 * until Voi xChain support is confirmed (see docs/XCHAIN_ACCOUNTS_INTEGRATION_PLAN.md).
 */
export const xchainWagmiConfig = getDefaultConfig({
  appName: "DorkFi",
  projectId: walletConnectProjectId,
  chains: [algorandChain],
});
