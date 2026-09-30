import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { waitForConfirmation } from "algosdk";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNetwork } from "@/contexts/NetworkContext";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { useToast } from "@/hooks/use-toast";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
} from "@/config";
import {
  fetchAlgorandAlgoBalance,
  fetchAlgorandUsdcBalance,
  fetchBaseUsdcBalance,
  hasEnoughAlgorandAlgo,
} from "@/lib/easyStart/baseBalances";
import { recordAccountActivity } from "@/lib/easyStart/accountActivity";
import type { CashOutDestination, CashOutSource } from "@/lib/easyStart/cashOutSources";
import {
  clearPendingEarnWithdraw,
  isPendingEarnWithdrawComplete,
  patchPendingEarnWithdraw,
  pendingWithdrawBlocksNewSwap,
  readPendingEarnWithdraw,
  savePendingEarnWithdraw,
} from "@/lib/easyStart/pendingEarnWithdraw";
import { isXoGeoRestricted } from "@/lib/easyStart/xoSwap/errors";
import {
  easySavingsProductScope,
  resolveSavingsRoute,
} from "@/services/savingsRouteResolver";
import {
  getMaxWithdrawableForMarket,
  withdraw,
} from "@/services/lendingService";
import algorandService from "@/services/algorandService";
import {
  bridgePhaseLabel,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";
import { EasyStartOfframpCashOutSlot } from "@/components/easy-start/EasyStartOfframpCashOutSlot";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { Button } from "@/components/ui/button";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";
import { invalidateEasySavingsAfterTx } from "@/utils/easySavingsCache";

const EasyStartHeadlessBridge = lazy(() =>
  import("@/components/easy-start/EasyStartHeadlessBridge").then((m) => ({
    default: m.EasyStartHeadlessBridge,
  }))
);

type MovePhase = "working" | "swap_failed" | "cashout" | "kept" | "error";

function formatUsdcHuman(n: number): string {
  return n.toFixed(6).replace(/\.?0+$/, "") || "0";
}

/**
 * One progress surface: redeem Earn if needed, swap Algorand → Base,
 * then cash out or stop. A failed swap stays on the pending withdraw job.
 */
export function CashOutMovePanel({
  amount,
  source,
  destination,
  onDone,
}: {
  amount: string;
  source: Extract<CashOutSource, "earn" | "algorand">;
  destination: CashOutDestination;
  onDone: () => void;
}) {
  const { currentNetwork } = useNetwork();
  const networkId = currentNetwork as NetworkId;
  const privy = usePrivyEasyStart();
  const consumerCopy = useConsumerCopy();
  const { activeAccount, signTransactions, activeWallet } =
    useDorkFiWalletAdapter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<MovePhase>("working");
  const [bridgePhase, setBridgePhase] =
    useState<EasyStartBridgePhase>("preparing");
  const [bridgeAmount, setBridgeAmount] = useState<string | null>(null);
  const [baselineBaseUsdc, setBaselineBaseUsdc] = useState<number | undefined>();
  const [watchOnly, setWatchOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cashOutAmount, setCashOutAmount] = useState(amount);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);

  const finishOnBase = (received: string) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearPendingEarnWithdraw();
    setWatchOnly(false);
    setBridgeAmount(null);
    setCashOutAmount(received || amount);
    invalidateEasySavingsAfterTx({
      queryClient,
      networkId,
      address: activeAccount?.address,
    });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-base-usdc"] });
    if (destination === "account") {
      setPhase("kept");
      toast({
        title: consumerCopy ? "Back in your account" : "On Base",
        description: consumerCopy
          ? "The funds are in your account."
          : "USDC is in your Base wallet.",
      });
      return;
    }
    setPhase("cashout");
  };

  const beginSwap = async (swapAmount: number) => {
    const address = activeAccount?.address;
    if (!address) throw new Error("Connect first.");
    let algoUsdcBefore = swapAmount;
    let baseUsdcBefore: number | undefined;
    try {
      const algoBal = await fetchAlgorandUsdcBalance(address);
      const n = Number.parseFloat(algoBal.formatted);
      if (Number.isFinite(n) && n >= 0) algoUsdcBefore = n;
    } catch {
      algoUsdcBefore = swapAmount;
    }
    if (privy.evmAddress) {
      try {
        const baseBal = await fetchBaseUsdcBalance(privy.evmAddress as Address);
        const n = Number.parseFloat(baseBal.formatted);
        if (Number.isFinite(n) && n >= 0) baseUsdcBefore = n;
      } catch {
        baseUsdcBefore = undefined;
      }
    }
    const existing = readPendingEarnWithdraw(address);
    if (!existing) {
      savePendingEarnWithdraw({
        algorandAddress: address,
        evmAddress: privy.evmAddress ?? undefined,
        amount: swapAmount,
        algoUsdcBefore,
        ...(typeof baseUsdcBefore === "number" ? { baseUsdcBefore } : {}),
        expectedToAmount: swapAmount,
      });
    } else if (typeof baseUsdcBefore === "number" && existing.baseUsdcBefore == null) {
      patchPendingEarnWithdraw({ baseUsdcBefore });
    }
    setBaselineBaseUsdc(
      typeof baseUsdcBefore === "number"
        ? baseUsdcBefore
        : existing?.baseUsdcBefore
    );
    const human = formatUsdcHuman(swapAmount);
    setBridgeAmount(human);
    setCashOutAmount(human);
    const job = readPendingEarnWithdraw(address);
    if (job && pendingWithdrawBlocksNewSwap(job)) {
      setWatchOnly(true);
    } else {
      setWatchOnly(false);
    }
    setPhase("working");
  };

  const redeemEarn = async (humanAmount: string) => {
    const address = activeAccount?.address;
    if (!address || !signTransactions) {
      throw new Error(
        consumerCopy ? "Couldn’t confirm. Try again." : "Wallet cannot sign."
      );
    }
    const route = resolveSavingsRoute({
      networkId,
      assetConfigKey: "USDC",
      scope: easySavingsProductScope(consumerCopy),
    });
    if (!route) throw new Error("Earn isn’t available right now.");
    const algo = await fetchAlgorandAlgoBalance(address);
    if (!hasEnoughAlgorandAlgo(algo.valueMicro)) {
      throw new Error(
        consumerCopy
          ? "A small processing fee is needed to complete this. Deposit a little more, then retry."
          : "Algorand account needs ~0.1 ALGO for network fees."
      );
    }
    const max = await getMaxWithdrawableForMarket(
      route.poolId,
      route.asset.contractId,
      address,
      networkId,
      route.asset.decimals
    );
    const amountNum = Number(humanAmount);
    const maxUnderlying = max?.maxWithdrawUnderlying ?? amountNum;
    const withdrawAll =
      amountNum >= maxUnderlying * 0.999 ||
      Math.abs(amountNum - maxUnderlying) < 1e-8;
    const result = await withdraw(
      route.poolId,
      route.asset.contractId,
      route.asset.tokenStandard,
      humanAmount,
      address,
      networkId,
      {
        withdrawAll,
        maxWithdrawScaled: withdrawAll ? max?.maxWithdrawScaled : undefined,
      }
    );
    if (!result.success || !("txns" in result) || !result.txns?.length) {
      throw new Error(
        "error" in result && result.error
          ? String(result.error)
          : "Withdraw failed to build."
      );
    }
    toast({
      title: consumerCopy ? "Confirm" : "Please Sign Transaction",
      description: consumerCopy
        ? "Confirm once — we’ll move this to your account."
        : "Approve the withdraw.",
      duration: 12_000,
    });
    const signed = await withRainbowkitHostDialogDismissed({
      wallet: activeWallet,
      setSuppressed: () => {},
      leaveOverlayDismissedOnSuccess: true,
      run: () =>
        signTransactions(
          result.txns.map((txn) =>
            Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
          )
        ),
    });
    const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
    if (!algorandNetwork) throw new Error("This network is not Algorand-compatible.");
    const { algod } =
      await algorandService.initializeClientsForTransactions(algorandNetwork);
    const res = await algod.sendRawTransaction(signed).do();
    await waitForConfirmation(algod, res.txid, 4);
    recordAccountActivity({
      id: res.txid,
      address,
      networkId,
      title: consumerCopy ? "Left Earn" : "Withdrew",
      amount: humanAmount,
      symbol: "USDC",
    });
    return amountNum;
  };

  const start = async () => {
    setError(null);
    setPhase("working");
    const address = activeAccount?.address;
    if (!address) {
      setError(consumerCopy ? "Get started to cash out." : "Connect a wallet.");
      setPhase("error");
      return;
    }
    const pending = readPendingEarnWithdraw(address);
    if (pending) {
      setCashOutAmount(formatUsdcHuman(pending.amount));
      if (typeof pending.baseUsdcBefore === "number") {
        setBaselineBaseUsdc(pending.baseUsdcBefore);
      }
      setBridgeAmount(formatUsdcHuman(pending.amount));
      setWatchOnly(pendingWithdrawBlocksNewSwap(pending));
      setPhase("working");
      return;
    }
    try {
      const requested = Number(amount);
      if (!Number.isFinite(requested) || requested <= 0) {
        throw new Error("Enter an amount to cash out.");
      }
      if (source === "earn") {
        const redeemed = await redeemEarn(amount.trim());
        await beginSwap(redeemed);
        return;
      }
      await beginSwap(requested);
    } catch (err: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        // Overlay is already cleared by the helper on failure.
      }
      const { message } = getTransactionErrorFeedback(err);
      setError(message);
      setPhase("error");
    }
  };

  const finishOnBaseRef = useRef(finishOnBase);
  finishOnBaseRef.current = finishOnBase;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
    // Start once for this amount/source. Retry calls start() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "working" || !watchOnly || !privy.evmAddress) return;
    const evm = privy.evmAddress;
    let cancelled = false;
    void (async () => {
      for (let i = 0; i < 120 && !cancelled; i++) {
        const job = readPendingEarnWithdraw(activeAccount?.address);
        if (!job) return;
        try {
          const bal = await fetchBaseUsdcBalance(evm as Address);
          if (cancelled) return;
          const current = Number.parseFloat(bal.formatted);
          if (isPendingEarnWithdrawComplete(job, current)) {
            finishOnBaseRef.current(
              formatUsdcHuman(job.expectedToAmount || job.amount)
            );
            return;
          }
        } catch {
          // A single RPC miss should not drop the job.
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
      if (cancelled) return;
      setError(
        consumerCopy
          ? "Funds left Earn. Finish moving them to your account."
          : "Base USDC hasn’t arrived yet. Retry the swap — don’t withdraw again."
      );
      setWatchOnly(false);
      setPhase("swap_failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [
    phase,
    watchOnly,
    privy.evmAddress,
    activeAccount?.address,
    consumerCopy,
  ]);

  const retry = () => {
    finishedRef.current = false;
    const job = readPendingEarnWithdraw(activeAccount?.address);
    if (job) {
      setBridgeAmount(formatUsdcHuman(job.amount));
      setWatchOnly(pendingWithdrawBlocksNewSwap(job));
      setError(null);
      setPhase("working");
      if (typeof job.baseUsdcBefore === "number") {
        setBaselineBaseUsdc(job.baseUsdcBefore);
      }
      return;
    }
    startedRef.current = false;
    void start();
  };

  const title =
    phase === "swap_failed" || phase === "error"
      ? consumerCopy
        ? "Almost there"
        : "Didn’t finish"
      : phase === "kept"
        ? consumerCopy
          ? "Back in your account"
          : "On Base"
        : phase === "cashout"
          ? "Cash out"
          : source === "earn"
            ? consumerCopy
              ? "Moving from Earn"
              : "Withdrawing and swapping"
            : consumerCopy
              ? "Moving to your account"
              : "Swapping to Base";

  const description =
    phase === "cashout"
      ? "Fee and arrival time are shown on the next screen."
      : phase === "kept"
        ? consumerCopy
          ? "You can cash out later from this balance."
          : "USDC is in your Base wallet."
        : phase === "swap_failed"
          ? consumerCopy
            ? "Funds already left. Retry finishes the move — it won’t withdraw again."
            : "USDC is on Algorand. Retry the swap — don’t redeem again."
          : consumerCopy
            ? "This can take a few minutes. Keep this open."
            : "Waiting for the Algorand to Base swap.";

  return (
    <div className="px-6 pb-6 pt-3 space-y-4 text-center">
      <div className="space-y-2">
        <p className="text-xl font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {phase === "working" ? (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-ocean-teal" />
          {bridgeAmount ? (
            <p className="text-sm font-medium">
              {bridgePhaseLabel(bridgePhase, "algo-to-base")}
            </p>
          ) : (
            <p className="text-sm font-medium">
              {source === "earn"
                ? consumerCopy
                  ? "Confirming the Earn withdrawal"
                  : "Redeeming from savings"
                : consumerCopy
                  ? "Preparing the move"
                  : "Preparing the swap"}
            </p>
          )}
        </>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {isXoGeoRestricted(error)
            ? "USDC moves aren’t available in your region yet."
            : error}
        </p>
      ) : null}
      {phase === "swap_failed" || phase === "error" ? (
        <DorkFiButton className="w-full h-12" onClick={retry}>
          Retry
        </DorkFiButton>
      ) : null}
      {phase === "cashout" ? (
        <EasyStartOfframpCashOutSlot
          evmAddress={privy.evmAddress}
          amount={cashOutAmount}
          provider="coinbase"
          onProviderChange={() => {}}
          hideProviderPicker
          ctaLabel="Continue"
          onDone={onDone}
        />
      ) : null}
      {phase === "kept" ? (
        <Button className="w-full" onClick={onDone}>
          Done
        </Button>
      ) : null}
      {phase === "working" && bridgeAmount && !watchOnly ? (
        <Suspense fallback={null}>
          <EasyStartHeadlessBridge
            enabled
            amount={bridgeAmount}
            direction="algo-to-base"
            baselineBaseUsdc={baselineBaseUsdc}
            onFundsSent={(info) => {
              patchPendingEarnWithdraw({
                orderId: info.orderId,
                fromTxId: info.fromTxId,
                expectedToAmount: info.expectedToAmount,
              });
              setCashOutAmount(formatUsdcHuman(info.expectedToAmount));
              const address = activeAccount?.address;
              if (!address) return;
              recordAccountActivity({
                id: info.fromTxId || info.orderId,
                address,
                networkId,
                title: consumerCopy ? "Moved to account" : "Swap to Base",
                amount: formatUsdcHuman(info.expectedToAmount),
                symbol: "USDC",
                detail: info.orderId ? `Order ${info.orderId}` : undefined,
              });
            }}
            onPhaseChange={(next, err) => {
              setBridgePhase(next);
              if (next !== "error") return;
              const message = err ?? "Swap failed";
              const job = readPendingEarnWithdraw(activeAccount?.address);
              const evm = privy.evmAddress;
              void (async () => {
                if (job && evm) {
                  try {
                    const bal = await fetchBaseUsdcBalance(evm as Address);
                    const current = Number.parseFloat(bal.formatted);
                    if (isPendingEarnWithdrawComplete(job, current)) {
                      finishOnBase(formatUsdcHuman(job.expectedToAmount));
                      return;
                    }
                  } catch {
                    // Fall through to retry. The job stays.
                  }
                  if (pendingWithdrawBlocksNewSwap(job)) {
                    setWatchOnly(true);
                    setPhase("working");
                    return;
                  }
                }
                setError(message);
                setWatchOnly(false);
                setPhase("swap_failed");
              })();
            }}
            onComplete={() => {
              const job = readPendingEarnWithdraw(activeAccount?.address);
              finishOnBase(
                formatUsdcHuman(job?.expectedToAmount ?? Number(cashOutAmount))
              );
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
