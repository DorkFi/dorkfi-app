import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
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

const EASY_START_DIALOG_CONTENT_CLASS =
  "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-x-hidden overflow-y-auto flex flex-col p-0 overscroll-contain";

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
  /** picker = direction UI; panel = Allbridge. Parent `open` stays true for both. */
  const [step, setStep] = useState<"picker" | "panel">("picker");
  const [opening, setOpening] = useState(false);
  const [presetNonce, setPresetNonce] = useState(0);
  const presetPendingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setStep("picker");
      setOpening(false);
    }
  }, [open]);

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

  useEffect(() => {
    if (step !== "panel") {
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
    step,
    presetNonce,
    direction,
    bridge.initialLoadComplete,
    bridge.chains.length,
    bridge.setSourceChain,
    bridge.setDestinationChain,
    bridge.setSourceToken,
    bridge.setDestinationToken,
  ]);

  const handleOpenBridge = () => {
    if (!adapter.ready || !bridge.isAvailable) {
      toast({
        title: "Wallet not ready",
        description:
          "Your Easy Start Algorand account is still deriving. Wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }

    setOpening(true);
    presetPendingRef.current = true;
    setPresetNonce((n) => n + 1);
    setStep("panel");
    setOpening(false);
  };

  const handleRootOpenChange = (next: boolean) => {
    if (!next) {
      setStep("picker");
      onOpenChange(false);
      return;
    }
    onOpenChange(true);
  };

  const panelProps = mapBridgeToPanelProps(bridge, () =>
    handleRootOpenChange(false)
  );

  return (
    <>
      <Dialog
        open={open && step === "picker"}
        onOpenChange={handleRootOpenChange}
      >
        <DialogContent className={EASY_START_DIALOG_CONTENT_CLASS}>
          <div className="flex flex-col min-h-0">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0">
              <DialogHeader className="pb-0 space-y-2">
                <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                  Move to Algorand
                </DialogTitle>
                <div className="flex items-center justify-center gap-2 pb-1">
                  <ArrowRightLeft className="h-5 w-5 text-ocean-teal" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Base ↔ Algorand USDC
                  </span>
                </div>
                <DialogDescription className="text-center text-sm text-slate-600 dark:text-slate-400">
                  Bridge USDC to your Algorand account so you can supply to
                  DorkFi markets and earn yield.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 pb-6 pt-4 space-y-4">
              {evmAddress && adapter.activeAddress ? (
                <div className="space-y-1 text-xs text-center font-mono text-slate-500 dark:text-slate-400">
                  <p className="truncate">
                    From {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
                  </p>
                  <p className="truncate">
                    To {adapter.activeAddress.slice(0, 6)}…
                    {adapter.activeAddress.slice(-4)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-center text-amber-600 dark:text-amber-400">
                  {evmAddress
                    ? "Deriving Algorand account…"
                    : "Waiting for Easy Start wallet…"}
                </p>
              )}

              <Tabs
                value={direction}
                onValueChange={(v) =>
                  setDirection(v as XchainUsdcBridgeDirection)
                }
              >
                <TabsList className="grid w-full grid-cols-2 bg-white/60 dark:bg-slate-900/50">
                  <TabsTrigger value="base-to-algo">
                    Base → Algorand
                  </TabsTrigger>
                  <TabsTrigger value="algo-to-base">
                    Algorand → Base
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                type="button"
                className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold"
                disabled={!adapter.ready || !bridge.isAvailable || opening}
                onClick={handleOpenBridge}
              >
                {opening ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opening bridge…
                  </>
                ) : !adapter.ready ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing wallet…
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Open bridge
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={open && step === "panel"}
        onOpenChange={handleRootOpenChange}
      >
        <DialogContent className={BRIDGE_PANEL_DIALOG_CLASS}>
          <div
            data-wallet-theme
            data-wallet-ui
            data-theme="dark"
            className="p-4"
          >
            <div className="mb-2">
              <h3 className="text-lg font-bold leading-none">Bridge</h3>
            </div>
            <BridgePanel {...panelProps} hideHeader autoFocusAmount />
          </div>
        </DialogContent>
      </Dialog>
    </>
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
