import { useQueryClient } from "@tanstack/react-query";
import {
  WalletUIProvider,
  type NoticesConfig,
} from "@txnlab/use-wallet-ui-react";
import type { ReactNode } from "react";
import { xchainWagmiConfig } from "@/wallet/xchainWagmiConfig";
import "@rainbow-me/rainbowkit/styles.css";
import "@txnlab/use-wallet-ui-react/dist/style.css";

const xchainWalletNotices: NoticesConfig = {
  "evm-connect": {
    kind: "disclaimer",
    text: (
      <>
        xChain Accounts are beta. Connecting an EVM wallet creates an Algorand
        account you control via EIP-712 signatures, not a seed phrase. Only use
        funds you accept risking, and confirm the app network is Algorand
        Mainnet when using this option.
      </>
    ),
  },
};

/** Isolated so SimplFi (consumer copy) never statically imports RainbowKit. */
export default function XchainPrefiWalletUI({
  children,
  enableXchainWagmi = true,
}: {
  children: ReactNode;
  enableXchainWagmi?: boolean;
}) {
  const queryClient = useQueryClient();
  return (
    <WalletUIProvider
      theme="dark"
      {...(enableXchainWagmi ? { wagmiConfig: xchainWagmiConfig } : {})}
      queryClient={queryClient}
      notices={xchainWalletNotices}
    >
      {children}
    </WalletUIProvider>
  );
}
