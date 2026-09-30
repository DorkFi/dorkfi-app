import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { waitForConfirmation } from "algosdk";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DorkFiButton from "@/components/ui/DorkFiButton";
import AssetSelector from "@/components/easy-borrow/AssetSelector";
import SupplyBorrowCongrats from "@/components/SupplyBorrowCongrats";
import { useToast } from "@/hooks/use-toast";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
} from "@/config";
import {
  fetchUserWalletBalance,
  getMaxWithdrawableForMarket,
  repay,
  repayAll,
  withdraw,
} from "@/services/lendingService";
import algorandService from "@/services/algorandService";
import { formatUsdAmount } from "@/lib/utils";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";
import { invalidateUserPositionRpcCache } from "@/utils/rpcReadCache";
import { appendLocalBorrowTx } from "@/services/borrowTransactionHistory";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { consumerAssetDisplayLabel, easySavingsProductScope, resolveSavingsRoute } from "@/services/savingsRouteResolver";
import {
  fetchAlgorandAlgoBalance,
  fetchAlgorandUsdcBalance,
  fetchBaseUsdcBalance,
  hasEnoughAlgorandAlgo,
} from "@/lib/easyStart/baseBalances";
import {
  EARN_REPAY_UNSAFE_MESSAGE,
  earnRedeemKeepsLoanSafe,
  maxEarnRedeemKeepingLoanSafe,
  repaySourceLabel,
  type RepaySource,
} from "@/lib/easyStart/repayFromBucket";
import { recordAccountActivity } from "@/lib/easyStart/accountActivity";
import { useEasySavingsQuote } from "@/hooks/useEasySavingsQuote";
import { useEasyStartBorrowDebt } from "@/hooks/useEasyStartBorrowDebt";
import {
  formatBorrowApyLabel,
  isAccruedDisplayable,
  type EasyStartBorrowPosition,
} from "@/hooks/useEasyStartBorrowDebt";

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
  | "no_debt"
  | "insufficient_balance"
  | "repay";

type EasyBorrowRepayModalProps = {
  isOpen: boolean;
  onClose: () => void;
  position: EasyStartBorrowPosition | null;
  networkId: NetworkId;
  onConnectWallet?: () => void;
};

function formatToken(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatAmountInput(n: number, decimals: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = Math.min(Math.max(decimals, 0), 6);
  return n.toFixed(d).replace(/\.?0+$/, "");
}

const EasyBorrowRepayModal = ({
  isOpen,
  onClose,
  position,
  networkId,
  onConnectWallet,
}: EasyBorrowRepayModalProps) => {
  const { activeAccount, signTransactions, activeWallet } =
    useDorkFiWalletAdapter();
  const { toast } = useToast();
  const consumerCopy = useConsumerCopy();
  const queryClient = useQueryClient();
  const privy = usePrivyEasyStart();
  const loan = useEasyStartBorrowDebt();

  const [amount, setAmount] = useState("");
  const [repaySource, setRepaySource] = useState<RepaySource>("algorand");
  const [repayPhase, setRepayPhase] = useState<"form" | "bridging">("form");
  const [bridgeAmount, setBridgeAmount] = useState<string | null>(null);
  const [baselineAlgoUsdc, setBaselineAlgoUsdc] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [rainbowkitSignDialogSuppressed, setRainbowkitSignDialogSuppressed] =
    useState(false);

  const market = position?.market ?? null;
  const rawSymbol = position?.symbol ?? "—";
  const symbol = consumerCopy
    ? consumerAssetDisplayLabel(rawSymbol)
    : rawSymbol;
  const logo = position?.logoPath || "/placeholder.svg";
  const debt = position?.amount ?? 0;
  const interest = position?.interest ?? 0;
  const principal = Math.max(0, debt - Math.max(0, interest));
  const showAccrued = isAccruedDisplayable(interest);
  const apyLabel = formatBorrowApyLabel(position?.apyPercent);
  const amountNum = parseFloat(amount) || 0;

  const walletQuery = useQuery({
    queryKey: [
      "easy-start-repay-wallet",
      networkId,
      activeAccount?.address,
      market?.configKey,
    ],
    enabled: Boolean(isOpen && market && activeAccount?.address),
    staleTime: 15_000,
    queryFn: async () => {
      if (!market || !activeAccount?.address) return null;
      return fetchUserWalletBalance(
        activeAccount.address,
        market.configKey,
        networkId
      );
    },
  });

  const usdcRoute = useMemo(
    () =>
      resolveSavingsRoute({
        networkId,
        assetConfigKey: "USDC",
        scope: easySavingsProductScope(consumerCopy),
      }),
    [networkId, consumerCopy]
  );
  const earnQuote = useEasySavingsQuote({
    networkId,
    route: usdcRoute,
    amount: "",
  });
  const earnBalance = earnQuote.existingDeposit ?? 0;
  const baseQuery = useQuery({
    queryKey: ["easy-start-base-usdc", privy.evmAddress],
    queryFn: () => fetchBaseUsdcBalance(privy.evmAddress as Address),
    enabled: Boolean(isOpen && privy.evmAddress),
    staleTime: 15_000,
  });
  const baseBalance = baseQuery.data
    ? Number.parseFloat(baseQuery.data.formatted)
    : 0;
  const earnUnsafe =
    repaySource === "earn" &&
    amountNum > 0 &&
    !loan.isLoading &&
    !earnRedeemKeepsLoanSafe({
      collateralUsd: loan.collateralUsd,
      borrowUsd: loan.totalUsd,
      redeemUsd: amountNum,
    });

  const walletBalance = walletQuery.data ?? null;
  const walletBalanceReady = !walletQuery.isLoading && walletBalance != null;
  const sourceBalance =
    repaySource === "base"
      ? baseBalance
      : repaySource === "earn"
        ? earnBalance
        : walletBalance;
  const maxRepay = (() => {
    if (debt <= 0) return 0;
    const cap = sourceBalance ?? 0;
    if (repaySource === "earn") {
      const safe = maxEarnRedeemKeepingLoanSafe({
        collateralUsd: loan.collateralUsd,
        borrowUsd: loan.totalUsd,
      });
      return Math.max(0, Math.min(debt, cap, safe));
    }
    return Math.max(0, Math.min(debt, cap));
  })();

  useEffect(() => {
    if (!isOpen) return;
    setAmount("");
    setIsSubmitting(false);
    setShowSuccess(false);
    setTxId(null);
    setRainbowkitSignDialogSuppressed(false);
    setRepaySource("algorand");
    setRepayPhase("form");
    setBridgeAmount(null);
  }, [isOpen, position?.id]);

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (debt <= 1e-12) return "no_debt";
    if (!position || amountNum <= 0) return "enter_amount";
    if (amountNum > debt + 1e-8) return "insufficient_balance";
    if (repaySource === "algorand" && !walletBalanceReady) return "enter_amount";
    if (sourceBalance == null) return "enter_amount";
    if (amountNum > sourceBalance + 1e-8) return "insufficient_balance";
    if (earnUnsafe) return "insufficient_balance";
    return "repay";
  })();

  const ctaLabel: Record<CtaState, string> = {
    connect: "Get Started",
    enter_amount: "Enter Amount",
    no_debt: "Nothing to Repay",
    insufficient_balance: "Insufficient Balance",
    repay: isSubmitting
      ? consumerCopy
        ? "Confirming…"
        : "Confirm in wallet…"
      : repaySource === "base"
        ? "Move and repay"
        : repaySource === "earn"
          ? consumerCopy
            ? "Use Earn"
            : "Withdraw and repay"
          : "Repay",
  };

  const ctaDisabled =
    isSubmitting ||
    repayPhase === "bridging" ||
    (ctaState !== "connect" && ctaState !== "repay");

  const invalidateAfterRepay = () => {
    const address = activeAccount?.address?.trim();
    if (address) {
      invalidateUserPositionRpcCache(networkId, address);
    }
    void queryClient.invalidateQueries({ queryKey: ["easyBorrow"] });
    void queryClient.invalidateQueries({ queryKey: ["has-open-borrow"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-borrow-debt"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-repay-wallet"] });
    void queryClient.invalidateQueries({ queryKey: ["easySavings"] });
  };

  const handleRepay = async (opts?: { skipBalanceCheck?: boolean }) => {
    if (!opts?.skipBalanceCheck && ctaState === "connect") {
      onConnectWallet?.();
      return;
    }
    if (
      !opts?.skipBalanceCheck &&
      (ctaState !== "repay" || !position || !market || !activeAccount?.address)
    ) {
      return;
    }
    if (!position || !market || !activeAccount?.address) return;
    if (!signTransactions) {
      toast({
        title: "Cannot repay",
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

    const amountHuman = amount.trim();
    if (!amountHuman || !(parseFloat(amountHuman) > 0)) {
      toast({
        title: "Enter an amount",
        description: "Choose how much to repay.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Match RepayModal: repayAll only when the typed amount equals full debt
      // after 6-decimal rounding. A 1 vs 1.0001 repay is partial — repayAll
      // adds ~1% surplus and fails if the wallet only holds the borrowed amount.
      const roundedAmount = Math.round(amountNum * 1e6) / 1e6;
      const roundedDebt = Math.round(debt * 1e6) / 1e6;
      const closeLoan =
        !opts?.skipBalanceCheck &&
        debt > 0 &&
        roundedAmount === roundedDebt &&
        walletBalance != null &&
        walletBalance + 1e-8 >= amountNum * 1.01;

      const result = closeLoan
        ? await repayAll(
            market.poolId,
            market.contractId,
            market.tokenStandard,
            amountHuman,
            activeAccount.address,
            networkId
          )
        : await repay(
            market.poolId,
            market.contractId,
            market.tokenStandard,
            amountHuman,
            activeAccount.address,
            networkId
          );

      if (!result.success) {
        throw new Error(
          "error" in result && result.error
            ? String(result.error)
            : "Repay failed to build."
        );
      }
      if (!("txns" in result) || !result.txns?.length) {
        throw new Error("No transactions returned for repay.");
      }

      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: consumerCopy ? "Confirm" : "Please Sign Transaction",
        description: consumerCopy
          ? "Confirm this repayment."
          : `Approve the repay in ${walletName}.`,
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
      appendLocalBorrowTx({
        txId: res.txid,
        networkId,
        address: activeAccount.address,
        poolId: market.poolId,
        assetConfigKey: market.configKey,
        kind: "repay",
        amount: amountHuman,
        symbol: rawSymbol,
        timestamp: Date.now(),
      });
      invalidateAfterRepay();
      toast({
        title: "Repay confirmed",
        description: `Repaid ${amountHuman} ${symbol}.`,
      });
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const { userRejected, message } = getTransactionErrorFeedback(e);
      toast({
        title: userRejected ? "Repay cancelled" : "Repay failed",
        description: userRejected
          ? consumerCopy
            ? "You can try again when you’re ready."
            : message
          : message,
        variant: "destructive",
        duration: 14_000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startBaseRepay = async () => {
    if (!activeAccount?.address || !privy.evmAddress) return;
    const algo = await fetchAlgorandUsdcBalance(activeAccount.address);
    const baseline = Number.parseFloat(algo.formatted);
    setBaselineAlgoUsdc(Number.isFinite(baseline) ? baseline : 0);
    setBridgeAmount(amount.trim());
    setRepayPhase("bridging");
  };

  const redeemEarnThenRepay = async () => {
    if (!activeAccount?.address || !signTransactions || !usdcRoute) return;
    if (earnUnsafe) return;
    setIsSubmitting(true);
    try {
      const algo = await fetchAlgorandAlgoBalance(activeAccount.address);
      if (!hasEnoughAlgorandAlgo(algo.valueMicro)) {
        throw new Error(
          consumerCopy
            ? "A small processing fee is needed before this repay."
            : "Algorand account needs ~0.1 ALGO for network fees."
        );
      }
      const max = await getMaxWithdrawableForMarket(
        usdcRoute.poolId,
        usdcRoute.asset.contractId,
        activeAccount.address,
        networkId,
        usdcRoute.asset.decimals
      );
      const maxUnderlying = max?.maxWithdrawUnderlying ?? amountNum;
      const withdrawAll =
        amountNum >= maxUnderlying * 0.999 ||
        Math.abs(amountNum - maxUnderlying) < 1e-8;
      const result = await withdraw(
        usdcRoute.poolId,
        usdcRoute.asset.contractId,
        usdcRoute.asset.tokenStandard,
        amount.trim(),
        activeAccount.address,
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
      const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
      if (!algorandNetwork) throw new Error("This network is not Algorand-compatible.");
      const { algod } =
        await algorandService.initializeClientsForTransactions(algorandNetwork);
      const res = await algod.sendRawTransaction(signed).do();
      await waitForConfirmation(algod, res.txid, 4);
      recordAccountActivity({
        id: res.txid,
        address: activeAccount.address,
        networkId,
        title: consumerCopy ? "Used Earn to repay" : "Withdrew to repay",
        amount: amount.trim(),
        symbol: "USDC",
      });
      await handleRepay({ skipBalanceCheck: true });
    } catch (e: unknown) {
      const { message } = getTransactionErrorFeedback(e);
      toast({
        title: "Couldn’t use Earn",
        description: message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handlePrimary = () => {
    if (ctaState === "connect") {
      onConnectWallet?.();
      return;
    }
    if (ctaState !== "repay") return;
    if (repaySource === "base") {
      void startBaseRepay();
      return;
    }
    if (repaySource === "earn") {
      void redeemEarnThenRepay();
      return;
    }
    void handleRepay();
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setTxId(null);
    setAmount("");
  };

  if (!position) return null;

  return (
    <>
    <Dialog
      open={isOpen && !rainbowkitSignDialogSuppressed}
      onOpenChange={(open) => {
        if (!open && !isSubmitting && repayPhase !== "bridging") onClose();
      }}
    >
      <DialogContent className={MODAL_SHELL}>
        <div className="max-h-[min(90vh,90dvh)] overflow-y-auto overscroll-contain px-5 pt-10 pb-6 sm:px-7 sm:pb-7">
          {repayPhase === "bridging" ? (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl font-bold">
                  {consumerCopy ? "Moving funds to repay" : "Swapping to Algorand"}
                </DialogTitle>
                <DialogDescription>
                  This can take a few minutes. Repay starts when the USDC arrives.
                </DialogDescription>
              </DialogHeader>
            </div>
          ) : showSuccess ? (
            <SupplyBorrowCongrats
              transactionType="repay"
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
              }}
              onMakeAnother={handleMakeAnother}
              onClose={onClose}
              viewTransactionDisabled={!txId}
            />
          ) : (
            <>
              <DialogHeader className="space-y-2 text-center pr-6">
                <DialogTitle className="text-2xl font-bold">Repay</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {consumerCopy
                    ? `Repay ${symbol} from available cash to reduce this loan.`
                    : `Repay ${symbol} from your wallet to reduce this loan.`}
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
                  label={`Repay ${symbol}`}
                  options={[
                    {
                      configKey: market?.configKey ?? symbol,
                      symbol,
                      logoPath: position.logoPath,
                      balance: walletBalance,
                      balanceUsd: null,
                    },
                  ]}
                  value={market?.configKey ?? symbol}
                  onChange={() => {}}
                  amount={amount}
                  onAmountChange={setAmount}
                  amountUsd={amountNum > 0 ? amountNum : null}
                  amountDisabled={isSubmitting}
                  showMax
                  onMax={() => {
                    if (maxRepay > 0) {
                      setAmount(
                        formatAmountInput(maxRepay, market?.decimals ?? 6)
                      );
                    }
                  }}
                  footer={
                    <span>
                      {consumerCopy ? "Available" : "Wallet"}:{" "}
                      {formatToken(walletBalance)} {symbol}
                      {debt > 0
                        ? ` · Debt ${formatToken(debt)} ${symbol}`
                        : ""}
                    </span>
                  }
                />

                <div className="rounded-2xl border border-border/60 divide-y divide-border/50 text-sm">
                  <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span className="text-muted-foreground shrink-0">
                      Principal
                    </span>
                    <span className="font-medium text-right">
                      {debt > 0
                        ? `${formatToken(principal, 6)} ${symbol}`
                        : "None"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span className="text-muted-foreground shrink-0">
                      Accrued
                    </span>
                    <span className="font-medium text-right">
                      {showAccrued
                        ? `${formatToken(interest, 6)} ${symbol}`
                        : apyLabel
                          ? `Accruing at ${apyLabel}`
                          : "—"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span className="text-muted-foreground shrink-0">
                      You repay
                    </span>
                    <span className="font-medium text-right">
                      {amountNum > 0
                        ? `${formatToken(amountNum, 6)} ${symbol} · ${formatUsdAmount(amountNum)}`
                        : `— ${symbol}`}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span className="text-muted-foreground shrink-0">
                      Remaining debt
                    </span>
                    <span className="font-medium text-right">
                      {debt > 0
                        ? `${formatToken(Math.max(0, debt - amountNum), 6)} ${symbol}`
                        : "None"}
                    </span>
                  </div>
                  {!consumerCopy ? (
                    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <span className="text-muted-foreground shrink-0">
                        Market
                      </span>
                      <span className="font-medium text-right">
                        {position.marketLabel} · {symbol}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(["algorand", "base", "earn"] as const).map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => setRepaySource(source)}
                      className={
                        repaySource === source
                          ? "rounded-xl border border-ocean-teal bg-ocean-teal/5 px-2 py-2 text-left"
                          : "rounded-xl border border-border px-2 py-2 text-left"
                      }
                    >
                      <span className="block text-xs font-semibold">
                        {repaySourceLabel(source, consumerCopy)}
                      </span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {formatToken(
                          source === "algorand"
                            ? walletBalance
                            : source === "base"
                              ? baseBalance
                              : earnBalance
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                {earnUnsafe ? (
                  <p className="text-xs text-destructive" role="alert">
                    {EARN_REPAY_UNSAFE_MESSAGE}
                  </p>
                ) : repaySource === "earn" && amountNum > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This withdraw stays above the loan safety line.
                  </p>
                ) : repaySource === "base" ? (
                  <p className="text-xs text-muted-foreground">
                    {consumerCopy
                      ? "We’ll move this into the account that can repay, then repay."
                      : "Base USDC is swapped to Algorand, then repaid."}
                  </p>
                ) : null}

                <DorkFiButton
                  variant="borrow"
                  className="w-full h-12"
                  disabled={ctaDisabled}
                  onClick={handlePrimary}
                >
                  {isSubmitting ? (
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
    {repayPhase === "bridging" && bridgeAmount ? (
      <Suspense fallback={null}>
        <EasyStartHeadlessBridge
          enabled
          amount={bridgeAmount}
          direction="base-to-algo"
          baselineAlgoUsdc={baselineAlgoUsdc}
          onFundsSent={(info) => {
            if (!activeAccount?.address) return;
            recordAccountActivity({
              id: info.fromTxId || info.orderId,
              address: activeAccount.address,
              networkId,
              title: consumerCopy ? "Moved to repay" : "Swap to Algorand",
              amount: String(info.expectedToAmount),
              symbol: "USDC",
              detail: info.orderId ? `Order ${info.orderId}` : undefined,
            });
          }}
          onPhaseChange={(phase, err) => {
            if (phase !== "error") return;
            setRepayPhase("form");
            setBridgeAmount(null);
            toast({
              title: "Couldn’t move funds",
              description: err ?? "Swap failed",
              variant: "destructive",
            });
          }}
          onComplete={() => {
            setRepayPhase("form");
            setBridgeAmount(null);
            void handleRepay({ skipBalanceCheck: true });
          }}
        />
      </Suspense>
    ) : null}
    </>
  );
};

export default EasyBorrowRepayModal;
