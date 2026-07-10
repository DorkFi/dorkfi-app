import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { WalletUIProvider, useBridgeDialog } from "@txnlab/use-wallet-ui-react";
import { useWallets } from "@privy-io/react-auth";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { privyBridgeWagmiConfig } from "@/wallet/privyBridgeWagmiConfig";
import { usePrivyEmbeddedWallet } from "@/hooks/usePrivyEmbeddedWallet";
import type { XchainUsdcBridgeDirection } from "@/components/xchain/XchainUsdcBridgeControls";

const BRIDGE_CHAIN_ALG = "ALG";
const BRIDGE_CHAIN_BASE = "BAS";
const BRIDGE_TOKEN_USDC = "USDC";

interface EasyStartBridgeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EasyStartBridgeSheetInner({
  open,
  onOpenChange,
}: EasyStartBridgeSheetProps) {
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { wallet: embeddedWallet } = usePrivyEmbeddedWallet();
  const { openBridge, bridge, isOpen: bridgeDialogOpen } = useBridgeDialog();
  const [direction, setDirection] = useState<XchainUsdcBridgeDirection>(
    "base-to-algo"
  );
  const [presetNonce, setPresetNonce] = useState(0);
  const presetPendingRef = useRef(false);
  const walletSyncedRef = useRef(false);

  useEffect(() => {
    if (!open || walletSyncedRef.current || !embeddedWallet) return;
    const match =
      wallets.find((w) => w.address === embeddedWallet.address) ?? embeddedWallet;
    void setActiveWallet(match).then(() => {
      walletSyncedRef.current = true;
    });
  }, [embeddedWallet, open, setActiveWallet, wallets]);

  useEffect(() => {
    if (!bridgeDialogOpen) {
      presetPendingRef.current = false;
      return;
    }
    if (!presetPendingRef.current) return;
    if (!bridge.initialLoadComplete || bridge.chains.length === 0) return;

    if (direction === "algo-to-base") {
      bridge.setSourceChain(BRIDGE_CHAIN_ALG);
      bridge.setDestinationChain(BRIDGE_CHAIN_BASE);
    } else {
      bridge.setSourceChain(BRIDGE_CHAIN_BASE);
      bridge.setDestinationChain(BRIDGE_CHAIN_ALG);
    }
    bridge.setSourceToken(BRIDGE_TOKEN_USDC);
    bridge.setDestinationToken(BRIDGE_TOKEN_USDC);
    presetPendingRef.current = false;
  }, [
    bridgeDialogOpen,
    presetNonce,
    direction,
    bridge.initialLoadComplete,
    bridge.chains.length,
    bridge.setSourceChain,
    bridge.setDestinationChain,
    bridge.setSourceToken,
    bridge.setDestinationToken,
  ]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-ocean-teal" />
            Move USDC to Algorand
          </SheetTitle>
          <SheetDescription>
            Bridge USDC from Base to your Algorand account so you can supply to
            DorkFi markets and earn yield.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Tabs
            value={direction}
            onValueChange={(v) => setDirection(v as XchainUsdcBridgeDirection)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="base-to-algo">Base → Algorand</TabsTrigger>
              <TabsTrigger value="algo-to-base">Algorand → Base</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            type="button"
            className="w-full bg-ocean-teal hover:bg-ocean-teal/90"
            onClick={() => {
              presetPendingRef.current = true;
              setPresetNonce((n) => n + 1);
              openBridge();
            }}
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Open bridge
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Isolated Privy + wagmi + Allbridge UI for Easy Start users (no RainbowKit connect required).
 */
export function EasyStartBridgeSheet(props: EasyStartBridgeSheetProps) {
  if (!props.open) return null;

  return (
    <PrivyWagmiProvider config={privyBridgeWagmiConfig}>
      <WalletUIProvider theme="dark" wagmiConfig={privyBridgeWagmiConfig}>
        <EasyStartBridgeSheetInner {...props} />
      </WalletUIProvider>
    </PrivyWagmiProvider>
  );
}
