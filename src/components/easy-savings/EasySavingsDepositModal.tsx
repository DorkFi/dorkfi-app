import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DorkFiButton from "@/components/ui/DorkFiButton";
import AssetSelector from "@/components/easy-borrow/AssetSelector";
import SavingsSummary from "@/components/easy-savings/SavingsSummary";
import SupplyBorrowCongrats from "@/components/SupplyBorrowCongrats";
import { useEasySavingsQuote } from "@/hooks/useEasySavingsQuote";
import { useToast } from "@/hooks/use-toast";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
} from "@/config";
import { deposit } from "@/services/lendingService";
import algorandService from "@/services/algorandService";
import {
  savingsAccountDisplayLabel,
  consumerAssetDisplayLabel,
} from "@/services/savingsRouteResolver";
import type { SavingsRoute } from "@/types/easySavings";
import { formatUsdAmount, cn } from "@/lib/utils";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { requestEasyStartSponsor } from "@/lib/easyStart/sponsorApi";
import {
  fetchAlgorandAlgoBalance,
  fetchAlgorandUsdcBalance,
  fetchBaseEthBalance,
  fetchBaseUsdcBalance,
  hasEnoughAlgorandAlgo,
  hasEnoughBaseEth,
} from "@/lib/easyStart/baseBalances";
import {
  bridgePhaseLabel,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";
import { isXoGeoRestricted, XO_GEO_RESTRICTED_MESSAGE } from "@/lib/easyStart/xoSwap/errors";
import { recordAccountActivity } from "@/lib/easyStart/accountActivity";
import {
  formatXoSwapMinUsd,
  XO_PAIR_BASE_TO_ALGO,
  XO_SWAP_MIN_USDC,
} from "@/lib/easyStart/xoSwap/constants";
import {
  quoteXoPair,
  xoPairQuoteExpired,
  xoPairQuoteOutOfRangeMessage,
} from "@/lib/easyStart/xoSwap/quotePair";
import {
  clearPendingEarnDeposit,
  isPendingEarnFunded,
  patchPendingEarnDeposit,
  pendingEarnBlocksNewSwap,
  pendingEarnSupplyAmount,
  readPendingEarnDeposit,
  savePendingEarnDeposit,
} from "@/lib/easyStart/pendingEarnDeposit";
import { usePendingEarnDeposit } from "@/hooks/usePendingEarnDeposit";
import { useXoDepositQuote } from "@/hooks/useXoDepositQuote";
import type { Address } from "viem";
import {
  applyOptimisticSavingsPosition,
  invalidateEasySavingsAfterTx,
} from "@/utils/easySavingsCache";

const EasyStartHeadlessBridge = lazy(() =>
  import("@/components/easy-start/EasyStartHeadlessBridge").then((m) => ({
    default: m.EasyStartHeadlessBridge,
  }))
);

const MODAL_SHELL =
  "w-full max-w-[98vw] sm:max-w-md rounded-t-2xl sm:rounded-xl p-0 max-h-[min(90vh,90dvh)] overflow-hidden flex flex-col";

type CtaState =
  | "connect"
  | "enter_amount"
  | "insufficient_balance"
  | "cap_exceeded"
  | "swap_below_min"
  | "swap_above_max"
  | "supply";

type FlowPhase = "idle" | "bridging" | "supplying";

export type SavingsTxSuccessPayload = {
  txId: string;
  kind: "deposit" | "withdraw";
  amount: string;
  symbol: string;
  /** USD savings balance after this tx, for an instant Earn card update. */
  balanceAfterUsd?: number;
};

type EasySavingsDepositModalProps = {
  isOpen: boolean;
  onClose: () => void;
  route: SavingsRoute | null;
  networkId: NetworkId;
  isHighYield?: boolean;
  onConnectWallet?: () => void;
  onSuccess?: (payload: SavingsTxSuccessPayload) => void;
};

function formatToken(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatUsdcHuman(n: number): string {
  return n.toFixed(6).replace(/\.?0+$/, "") || "0";
}

const EasySavingsDepositModal = ({
  isOpen,
  onClose,
  route,
  networkId,
  isHighYield = false,
  onConnectWallet,
  onSuccess,
}: EasySavingsDepositModalProps) => {
  const { activeAccount, signTransactions, activeWallet } =
    useDorkFiWalletAdapter();
  const privy = usePrivyEasyStart();
  const { toast } = useToast();
  const consumerCopy = useConsumerCopy();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [rainbowkitSignDialogSuppressed, setRainbowkitSignDialogSuppressed] =
    useState(false);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [bridgePhase, setBridgePhase] =
    useState<EasyStartBridgePhase>("preparing");
  const [bridgeAmount, setBridgeAmount] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [baselineAlgoUsdc, setBaselineAlgoUsdc] = useState<number | null>(null);
  const [watchOnly, setWatchOnly] = useState(false);
  const pendingSupplyRef = useRef<string | null>(null);
  const resumeAttemptedRef = useRef(false);
  const supplyingLockRef = useRef(false);

  const quote = useEasySavingsQuote({
    networkId,
    route,
    amount,
  });

  const enableBaseBridge =
    privy.authenticated &&
    Boolean(privy.evmAddress) &&
    route?.asset.configKey === "USDC";

  const evmAddress = (privy.evmAddress ?? null) as Address | null;

  const { data: baseUsdc } = useQuery({
    queryKey: ["easy-start-base-usdc", evmAddress],
    queryFn: () => fetchBaseUsdcBalance(evmAddress!),
    enabled: Boolean(isOpen && enableBaseBridge && evmAddress),
    staleTime: 15_000,
  });

  const baseUsdcNum = (() => {
    if (!enableBaseBridge || !baseUsdc) return 0;
    const n = Number.parseFloat(baseUsdc.formatted);
    return Number.isFinite(n) ? n : 0;
  })();

  const algoWallet = quote.walletBalance ?? 0;
  const spendable = enableBaseBridge
    ? Math.max(0, algoWallet) + Math.max(0, baseUsdcNum)
    : quote.walletBalance;

  const rawSymbol = route ? savingsAccountDisplayLabel(route) : "—";
  const symbol = consumerCopy
    ? consumerAssetDisplayLabel(rawSymbol)
    : rawSymbol;
  const logo = route?.asset.logoPath || "/placeholder.svg";
  const amountNum = parseFloat(amount) || 0;

  const pendingEarn = usePendingEarnDeposit(activeAccount?.address);

  useEffect(() => {
    if (!isOpen) {
      resumeAttemptedRef.current = false;
      return;
    }
    setAdvancedOpen(false);
    setShowSuccess(false);
    setTxId(null);
    setRainbowkitSignDialogSuppressed(false);
    setFlowError(null);

    const job = pendingEarn ?? readPendingEarnDeposit(activeAccount?.address);
    if (job && route?.asset.configKey === "USDC") {
      setAmount(String(job.wantedAmount));
      pendingSupplyRef.current = String(job.wantedAmount);
      setBaselineAlgoUsdc(job.algoUsdcBefore);
      return;
    }

    setAmount("");
    setIsSubmitting(false);
    setFlowPhase("idle");
    setBridgeAmount(null);
    setBaselineAlgoUsdc(null);
    setWatchOnly(false);
    pendingSupplyRef.current = null;
  }, [
    isOpen,
    route?.asset.configKey,
    route?.poolId,
    activeAccount?.address,
    pendingEarn?.at,
    pendingEarn?.fromTxId,
  ]);

  const needsSwap =
    enableBaseBridge &&
    amountNum > algoWallet + 0.01 &&
    !pendingEarnBlocksNewSwap(pendingEarn, amountNum);
  const swapFromAmount = Math.max(0, amountNum - algoWallet);
  const xoQuote = useXoDepositQuote({
    enabled: Boolean(isOpen && needsSwap && swapFromAmount > 0),
    fromAmount: swapFromAmount,
  });
  const xoGeoBlocked = isXoGeoRestricted(xoQuote.error) || isXoGeoRestricted(flowError);
  const quotedSwapMin = xoQuote.data?.min;
  const xoSwapMin =
    quotedSwapMin != null && Number.isFinite(quotedSwapMin)
      ? quotedSwapMin
      : XO_SWAP_MIN_USDC;

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (!route || amountNum <= 0) return "enter_amount";
    if (spendable != null && amountNum > spendable + 1e-12) {
      return "insufficient_balance";
    }
    if (
      quote.remainingSupplyCap != null &&
      amountNum > quote.remainingSupplyCap + 1e-12
    ) {
      return "cap_exceeded";
    }
    if (needsSwap) {
      const quotedMin = xoQuote.data?.min;
      if (
        quotedMin != null &&
        Number.isFinite(quotedMin) &&
        swapFromAmount + 1e-9 < quotedMin
      ) {
        return "swap_below_min";
      }
      // Tell them before the quote returns. A live min replaces this once it loads.
      if (xoQuote.data == null && swapFromAmount + 1e-9 < XO_SWAP_MIN_USDC) {
        return "swap_below_min";
      }
      if (
        xoQuote.data &&
        !xoQuote.data.inRange &&
        xoQuote.data.max != null &&
        swapFromAmount > xoQuote.data.max
      ) {
        return "swap_above_max";
      }
    }
    return "supply";
  })();

  const ctaLabel: Record<CtaState, string> = {
    connect: consumerCopy ? "Get Started" : "Connect Wallet",
    enter_amount: "Enter Amount",
    insufficient_balance: "Insufficient Balance",
    cap_exceeded: consumerCopy ? "Limit Reached" : "Supply Cap Reached",
    swap_below_min: `XO Swap minimum is ${formatXoSwapMinUsd(xoSwapMin)}`,
    swap_above_max:
      xoQuote.data?.max != null
        ? `Maximum is ${formatToken(xoQuote.data.max)} USDC`
        : "Amount too large",
    supply: isSubmitting
      ? flowPhase === "bridging"
        ? consumerCopy
          ? "Moving to earn…"
          : "Bridging…"
        : consumerCopy
          ? "Confirming…"
          : "Supplying…"
      : needsSwap
        ? consumerCopy
          ? "Deposit to Earn"
          : "Bridge & supply"
        : consumerCopy
          ? "Deposit"
          : "Supply",
  };

  const busy =
    isSubmitting || flowPhase === "bridging" || flowPhase === "supplying";

  const swapQuoteBlocksConfirm =
    needsSwap &&
    (xoGeoBlocked ||
      xoQuote.isError ||
      (xoQuote.isPending && !xoQuote.data) ||
      (xoQuote.data != null &&
        (!xoQuote.data.inRange || xoQuote.data.toAmount == null)));

  const ctaDisabled =
    busy ||
    (ctaState !== "connect" && ctaState !== "supply") ||
    swapQuoteBlocksConfirm;

  const refreshAfterConfirmedSupply = (
    supplyAmount: string
  ): number | undefined => {
    const address = activeAccount?.address?.trim();
    const amountDelta = Number.parseFloat(supplyAmount);
    let balanceAfterUsd: number | undefined;
    if (address && route && Number.isFinite(amountDelta) && amountDelta > 0) {
      const { nextBalance } = applyOptimisticSavingsPosition({
        queryClient,
        networkId,
        address,
        poolId: route.poolId,
        contractId: route.asset.contractId,
        configKey: route.asset.configKey,
        delta: amountDelta,
      });
      const price = quote.price != null && quote.price > 0 ? quote.price : 1;
      balanceAfterUsd = nextBalance * price;
    }
    invalidateEasySavingsAfterTx({ queryClient, networkId, address });
    return balanceAfterUsd;
  };

  const runSupply = async (supplyAmount: string) => {
    if (!route || !activeAccount?.address || !signTransactions) {
      throw new Error("Cannot deposit");
    }
    const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
    if (!algorandNetwork) {
      throw new Error(
        consumerCopy
          ? "Please try again."
          : "This network is not Algorand-compatible."
      );
    }

    const amountInAtomicUnits = new BigNumber(supplyAmount)
      .multipliedBy(10 ** route.asset.decimals)
      .integerValue(BigNumber.ROUND_DOWN)
      .toFixed(0);

    if (amountInAtomicUnits === "0") {
      throw new Error("Amount is too small after decimal conversion.");
    }

    const result = await deposit(
      route.poolId,
      route.asset.contractId,
      route.asset.tokenStandard,
      amountInAtomicUnits,
      activeAccount.address,
      networkId
    );

    if (!result.success) {
      throw new Error(
        "error" in result && result.error
          ? String(result.error)
          : "Deposit failed to build."
      );
    }
    if (!("txns" in result) || !result.txns?.length) {
      throw new Error("No transactions returned for deposit.");
    }

    const walletName = activeWallet?.metadata?.name || "your wallet";
    toast({
      title: consumerCopy ? "Confirm" : "Please Sign Transaction",
      description: consumerCopy
        ? "Confirm this deposit."
        : `Approve the deposit in ${walletName}.`,
      duration: 12_000,
    });

    const signed = await withRainbowkitHostDialogDismissed({
      wallet: activeWallet,
      setSuppressed: setRainbowkitSignDialogSuppressed,
      leaveOverlayDismissedOnSuccess: true,
      run: () =>
        signTransactions(
          result.txns.map((txn) =>
            Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
          )
        ),
    });

    const { algod } =
      await algorandService.initializeClientsForTransactions(algorandNetwork);
    const res = await algod.sendRawTransaction(signed).do();
    await waitForConfirmation(algod, res.txid, 4);

    setTxId(res.txid);
    setShowSuccess(true);
    setRainbowkitSignDialogSuppressed(false);
    setFlowPhase("idle");
    setBridgeAmount(null);
    setWatchOnly(false);
    clearPendingEarnDeposit();
    const balanceAfterUsd = refreshAfterConfirmedSupply(supplyAmount);
    onSuccess?.({
      txId: res.txid,
      kind: "deposit",
      amount: supplyAmount,
      symbol,
      balanceAfterUsd,
    });
    toast({
      title: "Deposit confirmed",
      description: consumerCopy
        ? `Deposited ${supplyAmount} ${symbol}.`
        : `Supplied ${supplyAmount} ${symbol}.`,
    });
  };

  const supplyAfterBridge = async () => {
    if (supplyingLockRef.current) return;
    supplyingLockRef.current = true;
    setFlowPhase("supplying");
    setIsSubmitting(true);
    try {
      const job = readPendingEarnDeposit(activeAccount?.address);
      const algo = await fetchAlgorandUsdcBalance(activeAccount!.address);
      const available = Number.parseFloat(algo.formatted);
      const wanted = pendingSupplyRef.current ?? amount;
      const wantedNum = Number.parseFloat(wanted);
      const toSupply = job
        ? pendingEarnSupplyAmount(job, available)
        : Math.min(
            Number.isFinite(wantedNum) ? wantedNum : 0,
            Number.isFinite(available) ? available : 0
          );
      if (!(toSupply > 0.000001)) {
        throw new Error(
          consumerCopy
            ? "Funds didn’t arrive yet. Try Deposit to Earn again in a moment."
            : "Algorand USDC didn’t credit. Retry supply once the swap completes."
        );
      }
      await runSupply(formatUsdcHuman(toSupply));
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const { userRejected, message } = getTransactionErrorFeedback(e);
      setFlowError(message);
      setFlowPhase("idle");
      toast({
        title: userRejected ? "Deposit cancelled" : "Deposit failed",
        description: message,
        variant: "destructive",
        duration: 14_000,
      });
    } finally {
      supplyingLockRef.current = false;
      setIsSubmitting(false);
      setBridgeAmount(null);
      setWatchOnly(false);
    }
  };

  const supplyAfterBridgeRef = useRef(supplyAfterBridge);
  supplyAfterBridgeRef.current = supplyAfterBridge;

  useEffect(() => {
    if (!isOpen || resumeAttemptedRef.current) return;
    if (!activeAccount?.address || route?.asset.configKey !== "USDC") return;
    const job = pendingEarn ?? readPendingEarnDeposit(activeAccount.address);
    if (!job) return;
    resumeAttemptedRef.current = true;
    void (async () => {
      const bal = await fetchAlgorandUsdcBalance(activeAccount.address);
      const current = Number.parseFloat(bal.formatted);
      if (
        isPendingEarnFunded(job, current) ||
        current >= job.wantedAmount - 0.01
      ) {
        await supplyAfterBridgeRef.current();
        return;
      }
      if (job.fromTxId) {
        setWatchOnly(true);
        setBridgeAmount(formatUsdcHuman(job.fromBaseAmount));
        setFlowPhase("bridging");
        setIsSubmitting(true);
      }
    })();
  }, [isOpen, activeAccount?.address, route?.asset.configKey, pendingEarn]);

  useEffect(() => {
    if (!isOpen || flowPhase !== "bridging" || !watchOnly) return;
    const address = activeAccount?.address;
    const job = readPendingEarnDeposit(address);
    if (!address || !job) return;
    let cancelled = false;
    void (async () => {
      for (let i = 0; i < 120 && !cancelled; i++) {
        const bal = await fetchAlgorandUsdcBalance(address);
        const current = Number.parseFloat(bal.formatted);
        if (cancelled) return;
        if (
          isPendingEarnFunded(job, current) ||
          current >= job.wantedAmount - 0.01
        ) {
          await supplyAfterBridgeRef.current();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
      if (cancelled) return;
      const bal = await fetchAlgorandUsdcBalance(address);
      const current = Number.parseFloat(bal.formatted);
      if (pendingEarnSupplyAmount(job, current) > 0.000001) {
        await supplyAfterBridgeRef.current();
        return;
      }
      setFlowError(
        consumerCopy
          ? "The USDC move is still finishing. Try Deposit to Earn again."
          : "Swap timed out waiting for Algorand USDC."
      );
      setFlowPhase("idle");
      setIsSubmitting(false);
      setWatchOnly(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    flowPhase,
    watchOnly,
    activeAccount?.address,
    consumerCopy,
  ]);

  const handleSupply = async () => {
    if (ctaState === "connect") {
      onConnectWallet?.();
      return;
    }
    if (ctaState !== "supply" || !route || !activeAccount?.address) return;
    if (!signTransactions) {
      toast({
        title: "Cannot deposit",
        description: consumerCopy
          ? "Couldn’t confirm. Try again."
          : "Connected wallet does not support signing.",
        variant: "destructive",
      });
      return;
    }

    const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
    if (!algorandNetwork) {
      toast({
        title: "Something went wrong",
        description: consumerCopy
          ? "Please try again."
          : "This network is not Algorand-compatible.",
        variant: "destructive",
      });
      return;
    }

    setFlowError(null);
    setIsSubmitting(true);
    let holdBusy = false;
    try {
      if (privy.getAccessToken && privy.evmAddress) {
        const token = await privy.getAccessToken();
        if (!token) {
          throw new Error(
            consumerCopy
              ? "Sign in again, then retry."
              : "Sign in to fund this account before depositing."
          );
        }
        await requestEasyStartSponsor({
          accessToken: token,
          evmAddress: privy.evmAddress,
        });
      }

      const existing = readPendingEarnDeposit(activeAccount.address);
      if (existing && pendingEarnBlocksNewSwap(existing, amountNum)) {
        pendingSupplyRef.current = String(existing.wantedAmount);
        const live = await fetchAlgorandUsdcBalance(activeAccount.address);
        const current = Number.parseFloat(live.formatted);
        if (
          isPendingEarnFunded(existing, current) ||
          current >= existing.wantedAmount - 0.01
        ) {
          holdBusy = true;
          await supplyAfterBridge();
          return;
        }
        setWatchOnly(true);
        setBridgeAmount(formatUsdcHuman(existing.fromBaseAmount));
        setBaselineAlgoUsdc(existing.algoUsdcBefore);
        setFlowPhase("bridging");
        holdBusy = true;
        return;
      }

      if (needsSwap && evmAddress) {
        const eth = await fetchBaseEthBalance(evmAddress);
        if (!hasEnoughBaseEth(eth.value)) {
          throw new Error(
            consumerCopy
              ? "This account is still being set up on Base. Try again in a moment."
              : "Base wallet needs a little ETH before the USDC move."
          );
        }
        const algo = await fetchAlgorandAlgoBalance(activeAccount.address);
        if (!hasEnoughAlgorandAlgo(algo.valueMicro)) {
          throw new Error(
            consumerCopy
              ? "This account is still being set up on Algorand. Try again in a moment."
              : "Algorand account needs ~0.1 ALGO before the USDC move."
          );
        }
        const fromBase = Math.max(0, amountNum - algoWallet);
        const liveUsdc = await fetchAlgorandUsdcBalance(activeAccount.address);
        const baseline = Number.parseFloat(liveUsdc.formatted);
        const baselineSafe = Number.isFinite(baseline) ? baseline : algoWallet;
        let preview = xoQuote.data;
        if (
          !preview?.toAmount ||
          !preview.inRange ||
          xoPairQuoteExpired(preview)
        ) {
          preview = await quoteXoPair(XO_PAIR_BASE_TO_ALGO, fromBase);
        }
        if (!preview.inRange || preview.toAmount == null) {
          throw new Error(
            xoPairQuoteOutOfRangeMessage(preview) ??
              "This amount is outside the USDC move range"
          );
        }
        savePendingEarnDeposit({
          algorandAddress: activeAccount.address,
          evmAddress: evmAddress ?? undefined,
          wantedAmount: amountNum,
          fromBaseAmount: fromBase,
          expectedToAmount: preview.toAmount,
          algoUsdcBefore: baselineSafe,
          poolId: route.poolId,
          assetConfigKey: route.asset.configKey,
        });
        pendingSupplyRef.current = amount;
        setBaselineAlgoUsdc(baselineSafe);
        setWatchOnly(false);
        setBridgeAmount(formatUsdcHuman(fromBase));
        setFlowPhase("bridging");
        holdBusy = true;
        return;
      }

      await runSupply(amount);
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const { userRejected, message: raw } = getTransactionErrorFeedback(e);
      const geo = isXoGeoRestricted(e) || isXoGeoRestricted(raw);
      const message = geo ? XO_GEO_RESTRICTED_MESSAGE : raw;
      setFlowError(message);
      if (!geo) {
        toast({
          title: userRejected ? "Deposit cancelled" : "Deposit failed",
          description: message,
          variant: "destructive",
          duration: 14_000,
        });
      }
    } finally {
      if (!holdBusy) {
        setIsSubmitting(false);
      }
    }
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setTxId(null);
    setAmount("");
    setAdvancedOpen(false);
    setFlowPhase("idle");
    setBridgeAmount(null);
    setWatchOnly(false);
    pendingSupplyRef.current = null;
  };

  const showFlowStatus =
    !showSuccess && (flowPhase === "bridging" || flowPhase === "supplying");

  if (!route) return null;

  return (
    <>
      <Dialog
        open={isOpen && !rainbowkitSignDialogSuppressed}
        onOpenChange={(open) => {
          if (!open && !busy) onClose();
        }}
      >
        <DialogContent className={MODAL_SHELL}>
          <div className="max-h-[min(90vh,90dvh)] overflow-y-auto overscroll-contain px-5 pt-10 pb-6 sm:px-7 sm:pb-7">
            {showSuccess ? (
              <SupplyBorrowCongrats
                transactionType="deposit"
                asset={symbol}
                assetIcon={logo}
                amount={amount}
                onViewTransaction={() => {
                  if (!txId) return;
                  window.open(
                    getExplorerTransactionUrl(networkId, txId),
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
                onGoToPortfolio={() => {
                  onClose();
                  window.location.href = "/portfolio";
                }}
                onMakeAnother={handleMakeAnother}
                onClose={onClose}
                viewTransactionDisabled={!txId}
              />
            ) : showFlowStatus ? (
              <div className="py-10 flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
                <p className="text-sm font-medium">
                  {flowPhase === "bridging"
                    ? bridgePhaseLabel(bridgePhase)
                    : consumerCopy
                      ? "Depositing into savings…"
                      : "Supplying to the market…"}
                </p>
                {flowError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {flowError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {consumerCopy
                      ? "This can take a few minutes. Keep this open."
                      : "XO Swap to Algorand, then supply. Keep this window open."}
                  </p>
                )}
              </div>
            ) : (
              <>
                <DialogHeader className="space-y-2 text-center pr-6">
                  <DialogTitle className="text-2xl font-bold">
                    {enableBaseBridge && consumerCopy
                      ? "Deposit to Earn"
                      : "Deposit"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {consumerCopy
                      ? `Deposit ${symbol} to earn ${
                          quote.supplyApyPercent != null
                            ? `${quote.supplyApyPercent.toFixed(2)}%`
                            : "—"
                        } APY.`
                      : `Supply ${symbol} to earn ${
                          quote.supplyApyPercent != null
                            ? `${quote.supplyApyPercent.toFixed(2)}%`
                            : "—"
                        } APY in ${route.marketLabel}.`}
                  </DialogDescription>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <img
                      src={logo}
                      alt=""
                      className="size-12 rounded-full shadow"
                    />
                    <span className="text-xl font-semibold">{symbol}</span>
                  </div>
                </DialogHeader>

                <div className="mt-6 space-y-4">
                  <AssetSelector
                    label={
                      consumerCopy ? `Deposit ${symbol}` : `Supply ${symbol}`
                    }
                    options={[
                      {
                        configKey: route.asset.configKey,
                        symbol,
                        logoPath: route.asset.logoPath,
                        balance: spendable,
                        balanceUsd:
                          spendable != null && quote.price != null
                            ? spendable * quote.price
                            : null,
                        subtitle: isHighYield
                          ? "Pooled · higher risk"
                          : undefined,
                      },
                    ]}
                    value={route.asset.configKey}
                    onChange={() => {}}
                    amount={amount}
                    onAmountChange={setAmount}
                    amountUsd={quote.amountUsd > 0 ? quote.amountUsd : null}
                    amountDisabled={busy}
                    showMax
                    onMax={() => {
                      if (spendable != null && spendable > 0) {
                        let max = spendable;
                        if (
                          quote.remainingSupplyCap != null &&
                          quote.remainingSupplyCap < max
                        ) {
                          max = quote.remainingSupplyCap;
                        }
                        setAmount(String(max));
                      }
                    }}
                    footer={
                      <span>
                        {consumerCopy ? "Available" : "Wallet"}:{" "}
                        {formatToken(spendable)} {symbol}
                        {spendable != null && quote.price != null
                          ? ` · ${formatUsdAmount(spendable * quote.price)}`
                          : ""}
                        {enableBaseBridge && baseUsdcNum > 0.01
                          ? consumerCopy
                            ? ` · In account ${formatToken(baseUsdcNum)}`
                            : ` · Base ${formatToken(baseUsdcNum)}`
                          : ""}
                        {quote.existingDeposit != null &&
                        quote.existingDeposit > 0
                          ? consumerCopy
                            ? ` · In savings ${formatToken(quote.existingDeposit)}`
                            : ` · Supplied ${formatToken(quote.existingDeposit)}`
                          : ""}
                        {isHighYield && !consumerCopy ? " · Pooled asset" : ""}
                      </span>
                    }
                  />

                  {enableBaseBridge ? (
                    <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                      {consumerCopy
                        ? `Moving USDC from your account uses Exodus XO Swap. That move has a ${formatXoSwapMinUsd(xoSwapMin)} minimum.`
                        : `Moving USDC from Base uses Exodus XO Swap. That move has a ${formatXoSwapMinUsd(xoSwapMin)} minimum.`}
                    </p>
                  ) : null}

                  <SavingsSummary route={route} amount={amount} quote={quote} />

                  {needsSwap ? (
                    <div className="rounded-2xl border border-border/60 divide-y divide-border/50 text-sm">
                      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span className="text-muted-foreground shrink-0">
                          {consumerCopy ? "Send" : "Send from Base"}
                        </span>
                        <span className="font-medium text-right">
                          {formatToken(swapFromAmount, 6)} USDC
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span className="text-muted-foreground shrink-0">
                          {consumerCopy
                            ? "Estimated receive"
                            : "Estimated Algorand USDC"}
                        </span>
                        <span className="font-medium text-right">
                          {xoQuote.data?.toAmount != null
                            ? `~${formatToken(xoQuote.data.toAmount, 6)} USDC`
                            : xoGeoBlocked
                              ? "—"
                              : xoQuote.isPending
                                ? "Getting a receive amount…"
                                : "—"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span className="text-muted-foreground shrink-0">
                          {consumerCopy
                            ? "Conversion fee"
                            : "Spread / miner fee"}
                        </span>
                        <span className="font-medium text-right">
                          {xoQuote.data?.toAmount != null
                            ? `${formatToken(
                                Math.max(
                                  0,
                                  swapFromAmount - xoQuote.data.toAmount
                                ),
                                6
                              )} USDC`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span className="text-muted-foreground shrink-0">
                          Min / max
                        </span>
                        <span className="font-medium text-right">
                          {xoQuote.data?.min != null &&
                          xoQuote.data.max != null
                            ? `${formatToken(xoQuote.data.min)} – ${formatToken(
                                xoQuote.data.max
                              )} USDC`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {!consumerCopy ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => setAdvancedOpen((v) => !v)}
                      >
                        Advanced details
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform",
                            advancedOpen && "rotate-180"
                          )}
                        />
                      </button>
                      {advancedOpen ? (
                        <dl className="space-y-1.5 rounded-xl border border-border/50 p-3 text-xs">
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">Market</dt>
                            <dd>
                              {route.marketLabel} · {route.asset.symbol}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">Pool ID</dt>
                            <dd className="font-mono">{route.poolId}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">Supply cap</dt>
                            <dd>{formatToken(quote.supplyCapHuman)}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-muted-foreground">
                              Remaining cap
                            </dt>
                            <dd>{formatToken(quote.remainingSupplyCap)}</dd>
                          </div>
                        </dl>
                      ) : null}
                    </>
                  ) : null}

                  {quote.error ? (
                    <p className="text-xs text-destructive">{quote.error}</p>
                  ) : null}
                  {flowError && !isXoGeoRestricted(flowError) ? (
                    <p className="text-xs text-destructive">{flowError}</p>
                  ) : null}
                  {xoQuote.isError &&
                  !xoGeoBlocked &&
                  !isXoGeoRestricted(flowError) ? (
                    <p className="text-xs text-destructive">
                      Couldn’t get a receive amount. Try again.
                    </p>
                  ) : null}
                  {xoGeoBlocked ? (
                    <p className="text-xs text-destructive">
                      {XO_GEO_RESTRICTED_MESSAGE}
                    </p>
                  ) : null}

                  {consumerCopy ? (
                    <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                      Depositing supplies your {symbol} to a shared lending
                      market that other people can borrow from. The APY is an
                      estimate and can change. This is not a bank account.{" "}
                      <Link
                        to="/disclosures"
                        className="text-ocean-teal underline-offset-2 hover:underline"
                      >
                        Disclosures
                      </Link>
                    </p>
                  ) : null}

                  <DorkFiButton
                    className="w-full h-12"
                    disabled={ctaDisabled}
                    onClick={() => {
                      void handleSupply();
                    }}
                  >
                    {busy ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        {ctaLabel[ctaState]}
                      </span>
                    ) : (
                      ctaLabel[ctaState]
                    )}
                  </DorkFiButton>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {flowPhase === "bridging" && bridgeAmount && !watchOnly ? (
        <Suspense fallback={null}>
          <EasyStartHeadlessBridge
            enabled
            amount={bridgeAmount}
            direction="base-to-algo"
            baselineAlgoUsdc={baselineAlgoUsdc ?? undefined}
            onFundsSent={(info) => {
              patchPendingEarnDeposit({
                orderId: info.orderId,
                fromTxId: info.fromTxId,
                expectedToAmount: info.expectedToAmount,
              });
              if (activeAccount?.address) {
                recordAccountActivity({
                  id: info.fromTxId || info.orderId,
                  address: activeAccount.address,
                  networkId,
                  title: consumerCopy ? "Moved to Earn" : "Swap to Algorand",
                  amount: String(info.expectedToAmount),
                  symbol: "USDC",
                  detail: info.orderId ? `Order ${info.orderId}` : undefined,
                });
              }
            }}
            onPhaseChange={(p, err) => {
              setBridgePhase(p);
              if (p === "error") {
                const job = readPendingEarnDeposit(activeAccount?.address);
                if (job && activeAccount?.address) {
                  void fetchAlgorandUsdcBalance(activeAccount.address).then(
                    (bal) => {
                      const current = Number.parseFloat(bal.formatted);
                      if (
                        isPendingEarnFunded(job, current) ||
                        current >= job.wantedAmount - 0.01
                      ) {
                        void supplyAfterBridge();
                        return;
                      }
                      setWatchOnly(true);
                      setFlowPhase("bridging");
                      setIsSubmitting(true);
                    }
                  );
                  return;
                }
                setFlowError(err ?? "Swap failed");
                setFlowPhase("idle");
                setBridgeAmount(null);
                setIsSubmitting(false);
              }
            }}
            onComplete={() => {
              void supplyAfterBridge();
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
};

export default EasySavingsDepositModal;
