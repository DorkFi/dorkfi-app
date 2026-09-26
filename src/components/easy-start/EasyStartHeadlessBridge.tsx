import { useEffect, useRef } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import {
  type EasyStartBridgeDirection,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";
import { runXoUsdcSwap } from "@/lib/easyStart/xoSwap/runUsdcSwap";

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
 * Invisible XO Swap runner for Easy Start orchestrated deposit/withdraw.
 * Mount only while swapping; uses Privy sendTransaction + xChain Algorand signing.
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
  // Privy replaces these callbacks after a signature. Reading them from refs
  // keeps the in-flight swap alive; putting them in the effect deps aborted
  // the Exodus call right after the USDC opt-in and left the spinner up.
  const signTransactionsRef = useRef(signTransactions);
  signTransactionsRef.current = signTransactions;
  const sendTransactionRef = useRef(sendTransaction);
  sendTransactionRef.current = sendTransaction;
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    if (!enabled) {
      startedRef.current = false;
      completedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    if (startedRef.current) return;
    if (
      !authenticated ||
      !evmAddress ||
      !algorandAddress ||
      !signTransactionsRef.current
    ) {
      onPhaseChangeRef.current?.("preparing");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      onPhaseChangeRef.current?.("error", "Invalid amount");
      return;
    }

    startedRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;
    const report = onPhaseChangeRef.current;

    void (async () => {
      try {
        await runXoUsdcSwap({
          direction,
          amount,
          evmAddress,
          algorandAddress,
          sendTransaction: (input, options) =>
            sendTransactionRef.current(input, options),
          signTransactions: (txns) => {
            const sign = signTransactionsRef.current;
            if (!sign) throw new Error("Easy Start wallet not ready");
            return sign(txns);
          },
          signal: ac.signal,
          onPhase: (phase, detail) => {
            if (ac.signal.aborted) return;
            if (phase === "error") {
              report?.(phase, detail ?? "Swap failed");
            } else {
              report?.(phase, null);
            }
          },
        });

        if (ac.signal.aborted || completedRef.current) return;
        completedRef.current = true;
        report?.("success");
        void queryClientRef.current.invalidateQueries({
          queryKey: ["easy-start-base-usdc"],
        });
        void queryClientRef.current.invalidateQueries({
          queryKey: ["easy-start-algo-usdc"],
        });
        void queryClientRef.current.invalidateQueries({
          queryKey: ["account-info"],
        });
        void queryClientRef.current.invalidateQueries({
          queryKey: ["account-balance"],
        });
        onCompleteRef.current?.();
      } catch (err) {
        if (ac.signal.aborted) return;
        const message = err instanceof Error ? err.message : "XO Swap failed";
        if (
          message === "Aborted" ||
          (err as { name?: string })?.name === "AbortError"
        ) {
          return;
        }
        report?.("error", message);
      }
    })();

    return () => {
      ac.abort();
      startedRef.current = false;
    };
  }, [
    enabled,
    authenticated,
    evmAddress,
    algorandAddress,
    amount,
    direction,
  ]);

  return null;
}
