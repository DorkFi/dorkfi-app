import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useEasySavingsQuote } from "@/hooks/useEasySavingsQuote";
import { useToast } from "@/hooks/use-toast";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
} from "@/config";
import {
  getMaxWithdrawableForMarket,
  withdraw,
} from "@/services/lendingService";
import algorandService from "@/services/algorandService";
import { savingsAccountDisplayLabel, consumerAssetDisplayLabel } from "@/services/savingsRouteResolver";
import type { SavingsRoute } from "@/types/easySavings";
import { formatUsdAmount } from "@/lib/utils";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import {
  fetchAlgorandAlgoBalance,
  hasEnoughAlgorandAlgo,
} from "@/lib/easyStart/baseBalances";
import {
  bridgePhaseLabel,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";
import { isXoGeoRestricted } from "@/lib/easyStart/xoSwap/errors";
import {
  type CardProvider,
} from "@/components/easy-start/EasyStartCardProviderPicker";
import { Button } from "@/components/ui/button";

const EasyStartHeadlessBridge = lazy(() =>
  import("@/components/easy-start/EasyStartHeadlessBridge").then((m) => ({
    default: m.EasyStartHeadlessBridge,
  }))
);

const EasyStartOfframpCashOut = lazy(() =>
  import("@/components/easy-start/EasyStartOfframpCashOut").then((m) => ({
    default: m.EasyStartOfframpCashOut,
  }))
);

const MODAL_SHELL =
  "w-full max-w-[98vw] sm:max-w-md rounded-t-2xl sm:rounded-xl p-0 max-h-[min(90vh,90dvh)] overflow-hidden flex flex-col";

type CtaState =
  | "connect"
  | "enter_amount"
  | "no_position"
  | "insufficient"
  | "withdraw";

type FlowPhase = "idle" | "bridging" | "swap_failed";

export type SavingsTxSuccessPayload = {
  txId: string;
  kind: "deposit" | "withdraw";
  amount: string;
  symbol: string;
};

type EasySavingsWithdrawModalProps = {
  isOpen: boolean;
  onClose: () => void;
  route: SavingsRoute | null;
  networkId: NetworkId;
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

const EasySavingsWithdrawModal = ({
  isOpen,
  onClose,
  route,
  networkId,
  onConnectWallet,
  onSuccess,
}: EasySavingsWithdrawModalProps) => {
  const { activeAccount, signTransactions, activeWallet } =
    useDorkFiWalletAdapter();
  const privy = usePrivyEasyStart();
  const { toast } = useToast();
  const consumerCopy = useConsumerCopy();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
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
  const [cashOutProvider, setCashOutProvider] =
    useState<CardProvider>("moonpay");
  const [confirmedAmount, setConfirmedAmount] = useState("");

  const quote = useEasySavingsQuote({
    networkId,
    route,
    amount,
  });

  const maxWithdrawQuery = useQuery({
    queryKey: [
      "easySavings",
      "maxWithdraw",
      networkId,
      activeAccount?.address,
      route?.poolId,
      route?.asset.contractId,
    ],
    enabled: Boolean(isOpen && route && activeAccount?.address),
    staleTime: 15_000,
    queryFn: async () => {
      if (!route || !activeAccount?.address) return null;
      return getMaxWithdrawableForMarket(
        route.poolId,
        route.asset.contractId,
        activeAccount.address,
        networkId,
        route.asset.decimals
      );
    },
  });

  const rawSymbol = route ? savingsAccountDisplayLabel(route) : "—";
  const symbol = consumerCopy
    ? consumerAssetDisplayLabel(rawSymbol)
    : rawSymbol;
  const logo = route?.asset.logoPath || "/placeholder.svg";
  const amountNum = parseFloat(amount) || 0;

  const bridgeToBase =
    privy.authenticated &&
    Boolean(privy.evmAddress) &&
    route?.asset.configKey === "USDC";

  const maxWithdrawable = (() => {
    const fromChain = maxWithdrawQuery.data?.maxWithdrawUnderlying;
    if (fromChain != null && Number.isFinite(fromChain) && fromChain >= 0) {
      return fromChain;
    }
    return quote.existingDeposit ?? 0;
  })();

  useEffect(() => {
    if (!isOpen) return;
    if (flowPhase === "bridging" || flowPhase === "swap_failed" || showSuccess)
      return;
    setAmount("");
    setIsSubmitting(false);
    setShowSuccess(false);
    setTxId(null);
    setRainbowkitSignDialogSuppressed(false);
    setFlowPhase("idle");
    setBridgeAmount(null);
    setFlowError(null);
    setConfirmedAmount("");
  }, [
    isOpen,
    route?.asset.configKey,
    route?.poolId,
    flowPhase,
    showSuccess,
  ]);

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (maxWithdrawable <= 1e-12) return "no_position";
    if (!route || amountNum <= 0) return "enter_amount";
    if (amountNum > maxWithdrawable + 1e-8) return "insufficient";
    return "withdraw";
  })();

  const busy =
    isSubmitting || flowPhase === "bridging";

  const ctaLabel: Record<CtaState, string> = {
    connect: consumerCopy ? "Get Started" : "Connect Wallet",
    enter_amount: "Enter Amount",
    no_position: "Nothing to Withdraw",
    insufficient: "Exceeds Withdrawable",
    withdraw: busy
      ? consumerCopy
        ? "Moving to your account…"
        : "Withdrawing…"
      : bridgeToBase
        ? consumerCopy
          ? "Withdraw to account"
          : "Withdraw to Base"
        : "Withdraw",
  };

  const ctaDisabled =
    busy || (ctaState !== "connect" && ctaState !== "withdraw");

  const invalidateQuotes = () => {
    void queryClient.invalidateQueries({ queryKey: ["easySavings"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-base-usdc"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-algo-usdc"] });
  };

  const handleWithdraw = async () => {
    if (ctaState === "connect") {
      onConnectWallet?.();
      return;
    }
    if (ctaState !== "withdraw" || !route || !activeAccount?.address) return;
    if (!signTransactions) {
      toast({
        title: "Cannot withdraw",
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
    try {
      if (bridgeToBase) {
        const algo = await fetchAlgorandAlgoBalance(activeAccount.address);
        if (!hasEnoughAlgorandAlgo(algo.valueMicro)) {
          throw new Error(
            consumerCopy
              ? "A small processing fee is needed to complete this withdrawal. Deposit a little more, then retry."
              : "Algorand account needs ~0.1 ALGO for network fees."
          );
        }
      }

      const amountHuman = amount.trim();
      if (!amountHuman || !(parseFloat(amountHuman) > 0)) {
        throw new Error("Enter a positive withdraw amount.");
      }

      const withdrawAll =
        amountNum >= maxWithdrawable * 0.999 ||
        Math.abs(amountNum - maxWithdrawable) < 1e-8;

      const result = await withdraw(
        route.poolId,
        route.asset.contractId,
        route.asset.tokenStandard,
        amountHuman,
        activeAccount.address,
        networkId,
        {
          withdrawAll,
          maxWithdrawScaled: withdrawAll
            ? maxWithdrawQuery.data?.maxWithdrawScaled
            : undefined,
        }
      );

      if (!result.success) {
        throw new Error(
          "error" in result && result.error
            ? String(result.error)
            : "Withdraw failed to build."
        );
      }
      if (!("txns" in result) || !result.txns?.length) {
        throw new Error("No transactions returned for withdraw.");
      }

      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: consumerCopy ? "Confirm" : "Please Sign Transaction",
        description: consumerCopy
          ? bridgeToBase
            ? "Confirm once — we’ll move this to your account."
            : "Confirm this withdrawal."
          : `Approve the withdraw in ${walletName}.`,
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
      setConfirmedAmount(formatUsdcHuman(amountNum));
      setRainbowkitSignDialogSuppressed(false);
      invalidateQuotes();
      onSuccess?.({
        txId: res.txid,
        kind: "withdraw",
        amount: amountHuman,
        symbol,
      });

      if (bridgeToBase) {
        setBridgeAmount(formatUsdcHuman(amountNum));
        setFlowPhase("bridging");
        toast({
          title: consumerCopy ? "Moving to your account" : "Bridging to Base",
          description: consumerCopy
            ? "This can take a few minutes."
            : "XO Swap Algorand → Base. Keep this open.",
        });
        return;
      }

      setShowSuccess(true);
      toast({
        title: "Withdraw confirmed",
        description: `Withdrew ${amount} ${symbol}.`,
      });
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const { userRejected, message } = getTransactionErrorFeedback(e);
      setFlowError(message);
      toast({
        title: userRejected ? "Withdraw cancelled" : "Withdraw failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const retrySwap = () => {
    if (!bridgeAmount) return;
    setFlowError(null);
    setFlowPhase("bridging");
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setTxId(null);
    setAmount("");
    setFlowPhase("idle");
    setBridgeAmount(null);
    setConfirmedAmount("");
  };

  const showFlowStatus =
    !showSuccess &&
    (flowPhase === "bridging" || flowPhase === "swap_failed");

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
              bridgeToBase ? (
                <div className="py-4 text-center space-y-4">
                  <DialogHeader className="space-y-2">
                    <DialogTitle className="text-xl font-bold">
                      {consumerCopy ? "Back in your account" : "USDC is on Base"}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      {consumerCopy
                        ? "Cash out with MoonPay or Coinbase, or keep the funds in your account."
                        : "Cash out in-app or keep USDC on Base."}
                    </DialogDescription>
                  </DialogHeader>
                  <Suspense fallback={null}>
                    <EasyStartOfframpCashOut
                      evmAddress={privy.evmAddress}
                      amount={confirmedAmount || amount}
                      provider={cashOutProvider}
                      onProviderChange={setCashOutProvider}
                      onDone={onClose}
                    />
                  </Suspense>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onClose}
                  >
                    {consumerCopy ? "Keep in account · Done" : "Keep on Base · Done"}
                  </Button>
                </div>
              ) : (
                <SupplyBorrowCongrats
                  transactionType="withdraw"
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
              )
            ) : showFlowStatus ? (
              <div className="py-10 flex flex-col items-center gap-3 text-center">
                {flowPhase === "bridging" ? (
                  <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
                ) : null}
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-xl font-bold">
                    {flowPhase === "swap_failed"
                      ? consumerCopy
                        ? "Almost there"
                        : "Swap didn’t finish"
                      : consumerCopy
                        ? "Moving to your account"
                        : "Moving to Base"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {flowPhase === "swap_failed"
                      ? consumerCopy
                        ? "Funds left savings. Retry to finish moving them to your account."
                        : "USDC is in your Algorand wallet. Retry the swap to Base — don’t withdraw from savings again."
                      : consumerCopy
                        ? "This can take a few minutes. Keep this open."
                        : "Confirmed on Algorand. Waiting for XO Swap to credit Base USDC."}
                  </DialogDescription>
                </DialogHeader>
                {flowPhase === "bridging" ? (
                  <p className="text-sm font-medium">
                    {bridgePhaseLabel(bridgePhase, "algo-to-base")}
                  </p>
                ) : null}
                {flowError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {isXoGeoRestricted(flowError)
                      ? "USDC moves aren’t available in your region yet."
                      : flowError}
                  </p>
                ) : null}
                {flowPhase === "swap_failed" ? (
                  <DorkFiButton
                    className="w-full h-12"
                    onClick={retrySwap}
                  >
                    Retry
                  </DorkFiButton>
                ) : null}
              </div>
            ) : (
              <>
                <DialogHeader className="space-y-2 text-center pr-6">
                  <DialogTitle className="text-2xl font-bold">
                    Withdraw
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {bridgeToBase
                      ? consumerCopy
                        ? `Withdraw ${symbol} to your account.`
                        : `Redeem from savings and swap to Base USDC.`
                      : `Withdraw ${symbol} from your savings.`}
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
                    label={`Withdraw ${symbol}`}
                    options={[
                      {
                        configKey: route.asset.configKey,
                        symbol,
                        logoPath: route.asset.logoPath,
                        balance: maxWithdrawable,
                        balanceUsd:
                          quote.price != null
                            ? maxWithdrawable * quote.price
                            : null,
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
                      if (maxWithdrawable > 0) {
                        setAmount(String(maxWithdrawable));
                      }
                    }}
                    footer={
                      <span>
                        Withdrawable: {formatToken(maxWithdrawable)} {symbol}
                        {quote.price != null && maxWithdrawable > 0
                          ? ` · ${formatUsdAmount(maxWithdrawable * quote.price)}`
                          : ""}
                        {quote.existingDeposit != null &&
                        quote.existingDeposit > 0
                          ? consumerCopy
                            ? ` · In savings ${formatToken(quote.existingDeposit)}`
                            : ` · Supplied ${formatToken(quote.existingDeposit)}`
                          : ""}
                      </span>
                    }
                  />

                  <div className="rounded-2xl border border-border/60 divide-y divide-border/50 text-sm">
                    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <span className="text-muted-foreground shrink-0">
                        You withdraw
                      </span>
                      <span className="font-medium text-right">
                        {amountNum > 0
                          ? `${formatToken(amountNum, 6)} ${symbol}${
                              quote.amountUsd > 0
                                ? ` · ${formatUsdAmount(quote.amountUsd)}`
                                : ""
                            }`
                          : `— ${symbol}`}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                      <span className="text-muted-foreground shrink-0">
                        {consumerCopy ? "In savings" : "Your position"}
                      </span>
                      <span className="font-medium text-right">
                        {quote.existingDeposit != null &&
                        quote.existingDeposit > 0
                          ? `${formatToken(quote.existingDeposit, 6)} ${symbol}`
                          : "None"}
                      </span>
                    </div>
                    {!consumerCopy ? (
                      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span className="text-muted-foreground shrink-0">
                          Market
                        </span>
                        <span className="font-medium text-right">
                          {route.marketLabel} · {route.asset.symbol}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {quote.error ? (
                    <p className="text-xs text-destructive">{quote.error}</p>
                  ) : null}
                  {flowError ? (
                    <p className="text-xs text-destructive">{flowError}</p>
                  ) : null}

                  <DorkFiButton
                    variant="withdraw"
                    className="w-full h-12"
                    disabled={ctaDisabled}
                    onClick={() => {
                      void handleWithdraw();
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

      {flowPhase === "bridging" && bridgeAmount ? (
        <Suspense fallback={null}>
          <EasyStartHeadlessBridge
            enabled
            amount={bridgeAmount}
            direction="algo-to-base"
            onPhaseChange={(p, err) => {
              setBridgePhase(p);
              if (p === "error") {
                setFlowError(err ?? "Swap failed");
                setFlowPhase("swap_failed");
              }
            }}
            onComplete={() => {
              setFlowPhase("idle");
              setShowSuccess(true);
              invalidateQuotes();
              toast({
                title: consumerCopy ? "Back in your account" : "On Base",
                description: consumerCopy
                  ? "You can cash out or keep the funds in your account."
                  : "USDC is in your Base wallet.",
              });
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
};

export default EasySavingsWithdrawModal;
