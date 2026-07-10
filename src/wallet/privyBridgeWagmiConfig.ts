import { createConfig } from "@privy-io/wagmi";
import { algorandChain } from "algo-x-evm-sdk";
import { http } from "wagmi";
import { base } from "viem/chains";

/**
 * Isolated wagmi config for Privy Easy Start bridge UI (Base ↔ Algorand USDC).
 * Kept separate from xchainWagmiConfig to avoid WalletConnect project id conflicts.
 */
export const privyBridgeWagmiConfig = createConfig({
  chains: [base, algorandChain],
  transports: {
    [base.id]: http(),
    [algorandChain.id]: http(),
  },
});
