import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import PreFi from "./pages/PreFi";
import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider,
  useWallet,
} from "@txnlab/use-wallet-react";

function App() {
  // TODO: replace with actual servers
  const { ALGO_SERVER, ALGO_INDEXER_SERVER } = {
    ALGO_SERVER: "https://mainnet-idx.voi.nodely.dev",
    ALGO_INDEXER_SERVER: "https://mainnet-idx.voi.nodely.dev",
  };

  let walletConnectProjectId;
  if (!walletConnectProjectId) {
    walletConnectProjectId = "e7b04c22de006e0fc7cef5a00cb7fac9";
  }

  const walletManager = new WalletManager({
    wallets: [
      WalletId.KIBISIS,
      {
        id: WalletId.LUTE,
        options: { siteName: "Nautilus" },
      },
      // TODO: add other wallet suport
      // {
      //   id: WalletId.BIATEC,
      //   options: {
      //     projectId: walletConnectProjectId,
      //     metadata: {
      //       name: "Nautilus",
      //       url: "https://nautilus.sh",
      //       description: "Nautilus NFT Marketplace",
      //       icons: ["https://nautilus.sh/favicon.ico"],
      //     },
      //     themeMode: "light",
      //   },
      // },
      // {
      //   id: WalletId.WALLETCONNECT,
      //   options: {
      //     projectId: walletConnectProjectId,
      //     metadata: {
      //       name: "Nautilus",
      //       url: "https://nautilus.sh",
      //       description: "Nautilus NFT Marketplace",
      //       icons: ["https://nautilus.sh/favicon.ico"],
      //     },
      //     themeMode: "light",
      //   },
      // },
    ],
    algod: {
      baseServer: ALGO_SERVER,
      port: "",
      token: "",
    },
    network: NetworkId.VOIMAIN,
  });
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <WalletProvider manager={walletManager}>
        <TooltipProvider delayDuration={300} skipDelayDuration={100}>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<PreFi />} />
              <Route path="/prefi" element={<PreFi />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;
