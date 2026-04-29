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

/**
 * Direction toggle + Bridge USDC for xChain (RainbowKit) on Algorand Mainnet.
 * Renders nothing when network or wallet does not qualify.
 */
export function XchainUsdcBridgeControls({
  className,
}: XchainUsdcBridgeControlsProps) {
  const { activeWallet } = useWallet();
  const { currentNetwork } = useNetwork();
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

  if (
    currentNetwork !== "algorand-mainnet" ||
    activeWallet?.id?.toLowerCase() !== "rainbowkit"
  ) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Tabs
        value={direction}
        onValueChange={(v) => setDirection(v as XchainUsdcBridgeDirection)}
      >
        <TabsList className="h-9 grid w-full max-w-[300px] grid-cols-2 rounded-xl border border-border bg-muted/30 p-1 dark:bg-muted/20 sm:w-[280px] sm:max-w-none">
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
        className="rounded-xl border-border bg-muted/30 dark:bg-muted/20 hover:bg-muted/50"
        onClick={() => {
          presetPendingRef.current = true;
          setPresetNonce((n) => n + 1);
          openBridge();
        }}
      >
        <ArrowRightLeft className="h-4 w-4 mr-2" />
        Bridge USDC
      </Button>
    </div>
  );
}
