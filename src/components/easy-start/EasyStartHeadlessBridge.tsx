import { useEffect, useRef } from "react";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useWallets } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useBridgePanel } from "@d13co/algo-x-evm-ui";
import { WalletUIProvider } from "@txnlab/use-wallet-ui-react";
import { privyBridgeWagmiConfig } from "@/wallet/privyBridgeWagmiConfig";
import { usePrivyEmbeddedWallet } from "@/hooks/usePrivyEmbeddedWallet";
import { usePrivyBridgeWalletAdapter } from "@/hooks/usePrivyBridgeWalletAdapter";
import {
  mapBridgeStatusToPhase,
  type EasyStartBridgeDirection,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";

const BRIDGE_CHAIN_ALG = "ALG";
const BRIDGE_CHAIN_BASE = "BAS";
const BRIDGE_TOKEN_USDC = "USDC";

interface EasyStartHeadlessBridgeProps {
  /** USDC amount to bridge (human units, e.g. "100"). */
  amount: string;
  enabled: boolean;
  /** Default Base → Algorand (deposit). Use algo-to-base for withdraw. */
  direction?: EasyStartBridgeDirection;
  onPhaseChange?: (phase: EasyStartBridgePhase, error?: string | null) => void;
  onComplete?: () => void;
}

function EasyStartHeadlessBridgeInner({
  amount,
  enabled,
  direction = "base-to-algo",
  onPhaseChange,
  onComplete,
}: EasyStartHeadlessBridgeProps) {
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { wallet: embeddedWallet } = usePrivyEmbeddedWallet();
  const adapter = usePrivyBridgeWalletAdapter();
  const bridge = useBridgePanel(adapter, { enabled });

  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const presetDoneRef = useRef(false);

  useEffect(() => {
    if (!embeddedWallet) return;
    const match =
      wallets.find(
        (w) => w.address.toLowerCase() === embeddedWallet.address.toLowerCase()
      ) ?? embeddedWallet;
    void setActiveWallet(match).catch((err: unknown) => {
      console.warn("Easy Start headless bridge: setActiveWallet failed", err);
    });
  }, [embeddedWallet, setActiveWallet, wallets]);

  useEffect(() => {
    if (!enabled || presetDoneRef.current) return;
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
    bridge.setAmount(amount);
    presetDoneRef.current = true;
  }, [
    enabled,
    amount,
    direction,
    bridge.initialLoadComplete,
    bridge.chains.length,
    bridge.setSourceChain,
    bridge.setDestinationChain,
    bridge.setSourceToken,
    bridge.setDestinationToken,
    bridge.setAmount,
  ]);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    if (!adapter.ready || !bridge.isAvailable) return;
    if (!bridge.initialLoadComplete || !presetDoneRef.current) return;
    if (!amount || Number(amount) <= 0) return;
    if (bridge.gasFeeLoading) return;
    if (bridge.amount !== amount) {
      bridge.setAmount(amount);
      return;
    }

    startedRef.current = true;
    void bridge.handleBridge();
  }, [
    enabled,
    adapter.ready,
    bridge.isAvailable,
    bridge.initialLoadComplete,
    bridge.gasFeeLoading,
    bridge.amount,
    bridge.handleBridge,
    bridge.setAmount,
    amount,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const phase = mapBridgeStatusToPhase(
      bridge.status,
      adapter.ready && bridge.isAvailable && bridge.initialLoadComplete
    );
    onPhaseChange?.(phase, bridge.error);

    if (phase === "success" && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [
    enabled,
    bridge.status,
    bridge.error,
    adapter.ready,
    bridge.isAvailable,
    bridge.initialLoadComplete,
    onPhaseChange,
    onComplete,
  ]);

  useEffect(() => {
    if (!enabled) {
      startedRef.current = false;
      completedRef.current = false;
      presetDoneRef.current = false;
      bridge.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return null;
}

/**
 * Invisible Allbridge runner for Easy Start orchestrated deposit/withdraw.
 * Mount only while bridging; keeps Privy wagmi isolated from RainbowKit.
 */
export function EasyStartHeadlessBridge(props: EasyStartHeadlessBridgeProps) {
  const queryClient = useQueryClient();

  if (!props.enabled) return null;

  return (
    <PrivyWagmiProvider config={privyBridgeWagmiConfig}>
      <WalletUIProvider theme="dark" queryClient={queryClient}>
        <EasyStartHeadlessBridgeInner {...props} />
      </WalletUIProvider>
    </PrivyWagmiProvider>
  );
}
