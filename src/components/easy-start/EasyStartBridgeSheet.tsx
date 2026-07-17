import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useWallets } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { BridgePanel, useBridgePanel } from "@d13co/algo-x-evm-ui";
import {
  WalletUIProvider,
  mapBridgeToPanelProps,
} from "@txnlab/use-wallet-ui-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { privyBridgeWagmiConfig } from "@/wallet/privyBridgeWagmiConfig";
import { usePrivyEmbeddedWallet } from "@/hooks/usePrivyEmbeddedWallet";
import { usePrivyBridgeWalletAdapter } from "@/hooks/usePrivyBridgeWalletAdapter";
import { useToast } from "@/hooks/use-toast";
import type { XchainUsdcBridgeDirection } from "@/components/xchain/XchainUsdcBridgeControls";

const BRIDGE_CHAIN_ALG = "ALG";
const BRIDGE_CHAIN_BASE = "BAS";
const BRIDGE_TOKEN_USDC = "USDC";

const BRIDGE_PANEL_DIALOG_CLASS =
  "bg-[var(--wui-color-bg,#0f172a)] text-[var(--wui-color-text,#f8fafc)] rounded-3xl border border-[var(--wui-color-border,rgba(148,163,184,0.2))] shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-x-hidden overflow-y-auto flex flex-col p-0 overscroll-contain";

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
  const { wallet: embeddedWallet, evmAddress } = usePrivyEmbeddedWallet();
  const adapter = usePrivyBridgeWalletAdapter();
  const { toast } = useToast();

  const [direction, setDirection] = useState<XchainUsdcBridgeDirection>(
    "base-to-algo"
  );
  const [presetNonce, setPresetNonce] = useState(0);
  const presetPendingRef = useRef(false);
  const notReadyToastShownRef = useRef(false);

  const bridge = useBridgePanel(adapter, { enabled: open });

  useEffect(() => {
    if (!embeddedWallet) return;
    const match =
      wallets.find(
        (w) => w.address.toLowerCase() === embeddedWallet.address.toLowerCase()
      ) ?? embeddedWallet;
    void setActiveWallet(match).catch((err: unknown) => {
      console.warn("Easy Start bridge: setActiveWallet failed", err);
    });
  }, [embeddedWallet, setActiveWallet, wallets]);

  // Open straight into Allbridge with Base→Algorand (Portfolio "Move to Algorand").
  useEffect(() => {
    if (!open) {
      presetPendingRef.current = false;
      notReadyToastShownRef.current = false;
      setDirection("base-to-algo");
      return;
    }
    presetPendingRef.current = true;
    setPresetNonce((n) => n + 1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
    open,
    presetNonce,
    direction,
    bridge.initialLoadComplete,
    bridge.chains.length,
    bridge.setSourceChain,
    bridge.setDestinationChain,
    bridge.setSourceToken,
    bridge.setDestinationToken,
  ]);

  useEffect(() => {
    if (!open) return;
    if (adapter.ready && bridge.isAvailable) {
      notReadyToastShownRef.current = false;
      return;
    }
    if (notReadyToastShownRef.current) return;
    const t = window.setTimeout(() => {
      if (adapter.ready && bridge.isAvailable) return;
      notReadyToastShownRef.current = true;
      toast({
        title: "Wallet not ready",
        description:
          "Your Easy Start Algorand account is still deriving. Wait a moment and try again.",
        variant: "destructive",
      });
    }, 12_000);
    return () => window.clearTimeout(t);
  }, [open, adapter.ready, bridge.isAvailable, toast]);

  const handleDirectionChange = (next: XchainUsdcBridgeDirection) => {
    setDirection(next);
    presetPendingRef.current = true;
    setPresetNonce((n) => n + 1);
  };

  const panelReady =
    open &&
    adapter.ready &&
    bridge.isAvailable &&
    bridge.initialLoadComplete;

  const panelProps = mapBridgeToPanelProps(bridge, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={BRIDGE_PANEL_DIALOG_CLASS}>
        <div
          data-wallet-theme
          data-wallet-ui
          data-theme="dark"
          className="p-4 space-y-3"
        >
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-lg font-bold leading-none">
              Bridge
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Base ↔ Algorand USDC via Allbridge
            </DialogDescription>
          </DialogHeader>

          {evmAddress && adapter.activeAddress ? (
            <div className="space-y-1 text-[11px] font-mono text-slate-400">
              <p className="truncate">
                From {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
              </p>
              <p className="truncate">
                To {adapter.activeAddress.slice(0, 6)}…
                {adapter.activeAddress.slice(-4)}
              </p>
            </div>
          ) : null}

          <Tabs
            value={direction}
            onValueChange={(v) =>
              handleDirectionChange(v as XchainUsdcBridgeDirection)
            }
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/80">
              <TabsTrigger value="base-to-algo">Base → Algorand</TabsTrigger>
              <TabsTrigger value="algo-to-base">Algorand → Base</TabsTrigger>
            </TabsList>
          </Tabs>

          {!panelReady ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-ocean-teal" />
              {!adapter.ready
                ? "Preparing Easy Start wallet…"
                : !bridge.isAvailable
                  ? "Loading Allbridge…"
                  : "Loading chains and balances…"}
              {!adapter.ready ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-400"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          ) : (
            <BridgePanel {...panelProps} hideHeader autoFocusAmount />
          )}

          {panelReady ? (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Bridging needs a little ETH on Base for gas (separate from USDC).
              If approve/send fails, fund a small amount of ETH on Base and retry.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Privy Easy Start bridge host — isolated from RainbowKit/WalletConnect.
 * Mount only once via EasyStartModalsProvider (not from Portfolio + header).
 */
export function EasyStartBridgeSheet(props: EasyStartBridgeSheetProps) {
  const queryClient = useQueryClient();

  if (!props.open) return null;

  return (
    <PrivyWagmiProvider config={privyBridgeWagmiConfig}>
      <WalletUIProvider theme="dark" queryClient={queryClient}>
        <EasyStartBridgeSheetInner {...props} />
      </WalletUIProvider>
    </PrivyWagmiProvider>
  );
}
