import { useEffect, useRef } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import {
  type EasyStartBridgeDirection,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";
import { runAramidUsdcBridge } from "@/lib/easyStart/aramid/runUsdcBridge";

interface EasyStartHeadlessBridgeProps {
  /** USDC amount to swap (human units, e.g. "100"). */
  amount: string;
  enabled: boolean;
  /** Default Base → Algorand (deposit). Use algo-to-base for withdraw. */
  direction?: EasyStartBridgeDirection;
  onPhaseChange?: (phase: EasyStartBridgePhase, error?: string | null) => void;
  onComplete?: () => void;
}

/**
 * Invisible Aramid Bridge runner for Easy Start orchestrated deposit/withdraw.
 * Mount only while bridging; uses Privy sendTransaction + xChain Algorand signing.
 */
export function EasyStartHeadlessBridge({
  amount,
  enabled,
  direction = "base-to-algo",
  onPhaseChange,
  onComplete,
}: EasyStartHeadlessBridgeProps) {
  const { sendTransaction } = useSendTransaction();
  const {
    evmAddress,
    algorandAddress,
    signTransactions,
    authenticated,
  } = usePrivyEasyStart();
  const queryClient = useQueryClient();

  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) {
      startedRef.current = false;
      completedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    if (startedRef.current) return;
    if (!authenticated || !evmAddress || !algorandAddress || !signTransactions) {
      onPhaseChange?.("preparing");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      onPhaseChange?.("error", "Invalid amount");
      return;
    }

    startedRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;

    void (async () => {
      try {
        await runAramidUsdcBridge({
          direction,
          amount,
          evmAddress,
          algorandAddress,
          sendTransaction,
          signTransactions,
          signal: ac.signal,
          onPhase: (phase, detail) => {
            if (phase === "error") {
              onPhaseChange?.(phase, detail ?? "Swap failed");
            } else {
              onPhaseChange?.(phase, null);
            }
          },
        });

        if (ac.signal.aborted || completedRef.current) return;
        completedRef.current = true;
        onPhaseChange?.("success");
        void queryClient.invalidateQueries({
          queryKey: ["easy-start-base-usdc"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["easy-start-algo-usdc"],
        });
        void queryClient.invalidateQueries({ queryKey: ["account-info"] });
        void queryClient.invalidateQueries({ queryKey: ["account-balance"] });
        onComplete?.();
      } catch (err) {
        if (ac.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Bridge failed";
        if (message === "Aborted" || (err as { name?: string })?.name === "AbortError") {
          return;
        }
        onPhaseChange?.("error", message);
      }
    })();

    return () => {
      ac.abort();
    };
    // Intentionally run once per enabled mount with the given amount/direction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    authenticated,
    evmAddress,
    algorandAddress,
    signTransactions,
    amount,
    direction,
  ]);

  return null;
}
