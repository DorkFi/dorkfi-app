import { useCallback, useEffect, useState } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
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
import {
  savingsAccountDisplayLabel,
  consumerAssetDisplayLabel,
} from "@/services/savingsRouteResolver";
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
import type { Address } from "viem";
import {
  fetchAlgorandAlgoBalance,
  fetchBaseUsdcBalance,
  hasEnoughAlgorandAlgo,
} from "@/lib/easyStart/baseBalances";
import {
  atomicToUsdc,
  atomicToUsdcString,
  splitAramidFee,
  usdcToAtomic,
} from "@/lib/easyStart/aramid/fees";
import { waitForBaseUsdcCredit } from "@/lib/easyStart/aramid/waitForBaseCredit";
import { isAramidCreditPendingError } from "@/lib/easyStart/aramid/creditPending";
import { assertAramidBaseCanRelease } from "@/lib/easyStart/aramid/liquidity";
import { findAramidAxferTxId } from "@/lib/easyStart/aramid/avmToBaseExtraTxn";
import type { SendUsdcFn } from "@/lib/easyStart/sendBaseUsdc";

function PrivySendTransactionBinder({
  onReady,
}: {
  onReady: (send: SendUsdcFn) => void;
}) {
  const { sendTransaction } = useSendTransaction();
  useEffect(() => {
    onReady((input) =>
      sendTransaction({
        to: input.to as `0x${string}`,
        data: input.data,
        value: input.value != null ? `0x${input.value.toString(16)}` : "0x0",
        chainId: input.chainId,
      })
    );
  }, [onReady, sendTransaction]);
  return null;
}

const MODAL_SHELL =
  "w-full max-w-[98vw] sm:max-w-md rounded-t-2xl sm:rounded-xl p-0 max-h-[min(90vh,90dvh)] overflow-hidden flex flex-col";

type CtaState =
  | "connect"
  | "enter_amount"
  | "no_position"
  | "insufficient"
  | "withdraw";

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

function isUsdcRoute(route: SavingsRoute | null): boolean {
  if (!route) return false;
  return route.asset.configKey === "USDC" || route.asset.symbol === "USDC";
}

const EasySavingsWithdrawModal = ({
  isOpen,
  onClose,
  route,
  networkId,
  onConnectWallet,
  onSuccess,
}: EasySavingsWithdrawModalProps) => {
  const { activeAccount, signTransactions, activeWallet, isPrivyEasyStart } =
    useDorkFiWalletAdapter();
  const privy = usePrivyEasyStart();
  const { toast } = useToast();
  const consumerCopy = useConsumerCopy();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waitingOnBase, setWaitingOnBase] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [rainbowkitSignDialogSuppressed, setRainbowkitSignDialogSuppressed] =
    useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [helpClaimUrl, setHelpClaimUrl] = useState<string | null>(null);
  const [sendTransaction, setSendTransaction] = useState<SendUsdcFn | null>(
    null
  );
  const bindSendTransaction = useCallback((fn: SendUsdcFn) => {
    setSendTransaction(() => fn);
  }, []);

  const quote = useEasySavingsQuote({
    networkId,
    route,
    amount,
  });

  const evmAddress = privy.evmAddress as Address | null;
  const bridgeToBase =
    isUsdcRoute(route) && isPrivyEasyStart && Boolean(evmAddress);

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

  const maxWithdrawable = (() => {
    const fromChain = maxWithdrawQuery.data?.maxWithdrawUnderlying;
    if (fromChain != null && Number.isFinite(fromChain) && fromChain >= 0) {
      return fromChain;
    }
    return quote.existingDeposit ?? 0;
  })();

  const feePreview = (() => {
    if (!bridgeToBase || amountNum <= 0) return null;
    try {
      const { feeAmount, destinationAmount } = splitAramidFee(
        usdcToAtomic(String(amountNum))
      );
      return {
        fee: atomicToUsdc(feeAmount),
        dest: atomicToUsdc(destinationAmount),
        destStr: atomicToUsdcString(destinationAmount),
      };
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!isOpen) return;
    if (waitingOnBase || showSuccess || helpClaimUrl) return;
    setAmount("");
    setIsSubmitting(false);
    setWaitingOnBase(false);
    setShowSuccess(false);
    setTxId(null);
    setFlowError(null);
    setConfirmedAmount("");
    setHelpClaimUrl(null);
    setRainbowkitSignDialogSuppressed(false);
  }, [
    isOpen,
    route?.asset.configKey,
    route?.poolId,
    waitingOnBase,
    showSuccess,
    helpClaimUrl,
  ]);

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (maxWithdrawable <= 1e-12) return "no_position";
    if (!route || amountNum <= 0) return "enter_amount";
    if (amountNum > maxWithdrawable + 1e-8) return "insufficient";
    return "withdraw";
  })();

  const busy = isSubmitting && !waitingOnBase;

  const ctaLabel: Record<CtaState, string> = {
    connect: consumerCopy ? "Get Started" : "Connect Wallet",
    enter_amount: "Enter Amount",
    no_position: "Nothing to Withdraw",
    insufficient: "Exceeds Withdrawable",
    withdraw: busy
      ? waitingOnBase
        ? consumerCopy
          ? "Moving to Base…"
          : "Bridging to Base…"
        : consumerCopy
          ? "Confirming…"
          : "Withdrawing…"
      : bridgeToBase
        ? consumerCopy
          ? "Withdraw to Base"
          : "Withdraw to Base"
        : "Withdraw",
  };

  const ctaDisabled =
    busy || (ctaState !== "connect" && ctaState !== "withdraw");

  const invalidateQuotes = () => {
    void queryClient.invalidateQueries({ queryKey: ["easySavings"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-base-usdc"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-algo-usdc"] });
    void queryClient.invalidateQueries({ queryKey: ["account-info"] });
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
      const amountHuman = amount.trim();
      if (!amountHuman || !(parseFloat(amountHuman) > 0)) {
        throw new Error("Enter a positive withdraw amount.");
      }

      if (bridgeToBase && activeAccount.address) {
        const algo = await fetchAlgorandAlgoBalance(activeAccount.address);
        if (!hasEnoughAlgorandAlgo(algo.valueMicro)) {
          throw new Error(
            consumerCopy
              ? "A small network fee is needed (~0.1 ALGO). Add a little ALGO, then try again."
              : "Your Algorand account needs ~0.1 ALGO for network fees."
          );
        }
        try {
          const { destinationAmount } = splitAramidFee(
            usdcToAtomic(amountHuman)
          );
          await assertAramidBaseCanRelease({
            destinationAtomic: destinationAmount,
            consumerCopy,
          });
        } catch (liqErr) {
          throw liqErr instanceof Error
            ? liqErr
            : new Error("Can't move USD right now. Try again in a bit.");
        }
      }

      const withdrawAll =
        amountNum >= maxWithdrawable * 0.999 ||
        Math.abs(amountNum - maxWithdrawable) < 1e-8;

      const baseBefore =
        bridgeToBase && evmAddress
          ? await fetchBaseUsdcBalance(evmAddress)
          : null;

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
          aramidToBaseEvmAddress: bridgeToBase
            ? evmAddress ?? undefined
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
            ? "Confirm once — we’ll move this to Base."
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
      invalidateQuotes();

      const aramid =
        "withdrawMeta" in result &&
        result.withdrawMeta &&
        "aramidToBase" in result.withdrawMeta
          ? result.withdrawMeta.aramidToBase
          : undefined;

      if (bridgeToBase && aramid && evmAddress && baseBefore) {
        setWaitingOnBase(true);
        setRainbowkitSignDialogSuppressed(false);
        const claimTxId =
          aramid.claimTxId ?? findAramidAxferTxId(result.txns) ?? res.txid;
        try {
          await waitForBaseUsdcCredit({
            evmAddress,
            start: baseBefore.value,
            minIncrease: BigInt(aramid.destinationAtomic),
            claimTxId,
            sendTransaction: sendTransaction ?? undefined,
            onClaim: () => {
              toast({
                title: consumerCopy ? "Confirm" : "Confirm on Base",
                description: consumerCopy
                  ? "Confirm once more to receive your USD."
                  : "Confirm in your wallet to receive USDC on Base.",
                duration: 12_000,
              });
            },
          });
        } catch (bridgeErr) {
          if (isAramidCreditPendingError(bridgeErr)) {
            setTxId(res.txid);
            setHelpClaimUrl(bridgeErr.claimUrl);
            setWaitingOnBase(false);
            setIsSubmitting(false);
            toast({
              title: consumerCopy ? "On the way" : "Still moving to Base",
              description: consumerCopy
                ? "Your USD is moving. You can close this and check back soon."
                : "USDC left savings and should arrive on Base within about an hour.",
            });
            return;
          }
          const message =
            bridgeErr instanceof Error ? bridgeErr.message : String(bridgeErr);
          setTxId(res.txid);
          setFlowError(message);
          toast({
            title: consumerCopy ? "On the way" : "Still moving",
            description: message,
          });
          setWaitingOnBase(false);
          setIsSubmitting(false);
          return;
        }
      }

      const received =
        aramid != null
          ? atomicToUsdcString(BigInt(aramid.destinationAtomic))
          : amount;

      setTxId(res.txid);
      setConfirmedAmount(received);
      setShowSuccess(true);
      setWaitingOnBase(false);
      setRainbowkitSignDialogSuppressed(false);
      invalidateQuotes();
      onSuccess?.({
        txId: res.txid,
        kind: "withdraw",
        amount: received,
        symbol,
      });
      toast({
        title: "Withdraw confirmed",
        description: bridgeToBase
          ? consumerCopy
            ? `${received} ${symbol} is on Base.`
            : `Received ${received} ${symbol} on Base.`
          : `Withdrew ${amount} ${symbol}.`,
      });
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const { userRejected, message } = getTransactionErrorFeedback(e);
      setWaitingOnBase(false);
      toast({
        title: userRejected ? "Withdraw cancelled" : "Withdraw failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setTxId(null);
    setAmount("");
    setWaitingOnBase(false);
    setFlowError(null);
    setConfirmedAmount("");
    setHelpClaimUrl(null);
  };

  if (!route) return null;

  return (
    <>
      {privy.enabled && privy.configured ? (
        <PrivySendTransactionBinder onReady={bindSendTransaction} />
      ) : null}
      <Dialog
      open={isOpen && !rainbowkitSignDialogSuppressed}
      onOpenChange={(open) => {
        if (!open) {
          if (isSubmitting && !waitingOnBase) return;
          onClose();
        }
      }}
    >
      <DialogContent className={MODAL_SHELL}>
        <div className="max-h-[min(90vh,90dvh)] overflow-y-auto overscroll-contain px-5 pt-10 pb-6 sm:px-7 sm:pb-7">
          {showSuccess ? (
            <SupplyBorrowCongrats
              transactionType="withdraw"
              asset={symbol}
              assetIcon={logo}
              amount={confirmedAmount || amount}
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
          ) : waitingOnBase || helpClaimUrl ? (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              {waitingOnBase ? (
                <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
              ) : null}
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl font-bold">
                  {consumerCopy ? "Moving your USD" : "Moving to Base"}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {consumerCopy
                    ? "This can take a few minutes. If asked, confirm once more to receive your USD. You can close this and check back soon."
                    : "Confirmed on Algorand. If prompted, confirm once more to receive USDC on Base."}
                </DialogDescription>
              </DialogHeader>
              {helpClaimUrl ? (
                <p className="text-sm px-4">
                  <a
                    href={helpClaimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ocean-teal underline break-all"
                  >
                    Need help?
                  </a>
                </p>
              ) : null}
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => onClose()}
              >
                {consumerCopy ? "Done for now" : "Close"}
              </button>
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
                      ? `Withdraw ${symbol} to Base in one confirmation.`
                      : `Redeem from savings and bridge to Base USDC in one signature.`
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
                  {bridgeToBase ? (
                    <>
                      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span className="text-muted-foreground shrink-0">
                          Move fee
                        </span>
                        <span className="font-medium text-right">
                          {feePreview
                            ? `${formatToken(feePreview.fee, 6)} ${symbol} · ~0.1%`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span className="text-muted-foreground shrink-0">
                          You receive on Base
                        </span>
                        <span className="font-medium text-right">
                          {feePreview
                            ? `${feePreview.destStr} ${symbol}`
                            : `— ${symbol}`}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span className="text-muted-foreground shrink-0">
                          Network fee
                        </span>
                        <span className="font-medium text-right">
                          {consumerCopy
                            ? "~0.1 ALGO (must already be in wallet)"
                            : "~0.1 ALGO on Algorand"}
                        </span>
                      </div>
                    </>
                  ) : null}
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
    </>
  );
};

export default EasySavingsWithdrawModal;
