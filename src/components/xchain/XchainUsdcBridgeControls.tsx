import { useEffect, useRef, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useBridgeDialog } from "@txnlab/use-wallet-ui-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Allbridge chain symbols (see @d13co/algo-x-evm-ui bridgeSdk DEFAULT_RPC_URLS). */
const BRIDGE_CHAIN_ALG = "ALG";
const BRIDGE_CHAIN_BASE = "BAS";
const BRIDGE_TOKEN_USDC = "USDC";

export type XchainUsdcBridgeDirection = "algo-to-base" | "base-to-algo";

export interface XchainUsdcBridgeControlsProps {
  className?: string;
}

/** When true, xChain bridge controls (direction + Bridge USDC) are shown. */
export function shouldShowXchainUsdcBridgeControls(
  currentNetwork: string,
  activeWalletId: string | undefined,
  privyEasyStartActive = false
): boolean {
  if (currentNetwork !== "algorand-mainnet") return false;
  if ((activeWalletId ?? "").toLowerCase() === "rainbowkit") return true;
  return privyEasyStartActive;
}

function XchainUsdcBridgeControlsInner({ className }: XchainUsdcBridgeControlsProps) {
  const { openBridge, bridge, isOpen: bridgeDialogOpen } = useBridgeDialog();
  const [direction, setDirection] = useState<XchainUsdcBridgeDirection>(
    "algo-to-base"
  );
  const [presetNonce, setPresetNonce] = useState(0);
  const presetPendingRef = useRef(false);

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
    <div
      className={cn(
        "flex min-w-0 w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2",
        className
      )}
    >
      <Tabs
        value={direction}
        onValueChange={(v) => setDirection(v as XchainUsdcBridgeDirection)}
        className="w-full min-w-0 sm:w-[280px] sm:shrink-0"
      >
        <TabsList className="grid h-9 w-full min-w-0 grid-cols-2 rounded-xl border border-border bg-muted/40 p-1 dark:bg-muted/25 sm:max-w-none">
          <TabsTrigger
            value="algo-to-base"
            className="rounded-lg text-xs px-2 data-[state=active]:shadow-sm"
          >
            Algorand → Base
          </TabsTrigger>
          <TabsTrigger
            value="base-to-algo"
            className="rounded-lg text-xs px-2 data-[state=active]:shadow-sm"
          >
            Base → Algorand
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full shrink-0 justify-center rounded-xl border-border bg-muted/40 dark:bg-muted/25 hover:bg-muted/60 dark:hover:bg-muted/35 sm:w-auto"
        onClick={() => {
          presetPendingRef.current = true;
          setPresetNonce((n) => n + 1);
          openBridge();
        }}
      >
        <ArrowRightLeft className="h-4 w-4 shrink-0" />
        Bridge USDC
      </Button>
    </div>
  );
}

/**
 * Direction toggle + Bridge USDC for xChain (RainbowKit) on Algorand Mainnet.
 * Renders nothing when network or wallet does not qualify.
 *
 * `useBridgeDialog` lives only on the inner branch so it is not invoked when wagmi
 * is omitted from WalletUIProvider (e.g. on VOI mainnet).
 */
export function XchainUsdcBridgeControls({
  className,
}: XchainUsdcBridgeControlsProps) {
  const { activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();

  if (!shouldShowXchainUsdcBridgeControls(currentNetwork, activeWallet?.id)) {
    return null;
  }

  return <XchainUsdcBridgeControlsInner className={className} />;
}
