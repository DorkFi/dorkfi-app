import { useEffect, useState } from "react";
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
import { savingsAccountDisplayLabel } from "@/services/savingsRouteResolver";
import type { SavingsRoute } from "@/types/easySavings";
import { formatUsdAmount } from "@/lib/utils";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [rainbowkitSignDialogSuppressed, setRainbowkitSignDialogSuppressed] =
    useState(false);

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
    enabled: Boolean(
      isOpen && route && activeAccount?.address
    ),
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

  const symbol = route ? savingsAccountDisplayLabel(route) : "—";
  const logo = route?.asset.logoPath || "/placeholder.svg";
  const amountNum = parseFloat(amount) || 0;

  const maxWithdrawable = (() => {
    const fromChain = maxWithdrawQuery.data?.maxWithdrawUnderlying;
    if (fromChain != null && Number.isFinite(fromChain) && fromChain >= 0) {
      return fromChain;
    }
    return quote.existingDeposit ?? 0;
  })();

  useEffect(() => {
    if (!isOpen) return;
    setAmount("");
    setIsSubmitting(false);
    setShowSuccess(false);
    setTxId(null);
    setRainbowkitSignDialogSuppressed(false);
  }, [isOpen, route?.asset.configKey, route?.poolId]);

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (maxWithdrawable <= 1e-12) return "no_position";
    if (!route || amountNum <= 0) return "enter_amount";
    if (amountNum > maxWithdrawable + 1e-8) return "insufficient";
    return "withdraw";
  })();

  const ctaLabel: Record<CtaState, string> = {
    connect: "Connect Wallet",
    enter_amount: "Enter Amount",
    no_position: "Nothing to Withdraw",
    insufficient: "Exceeds Withdrawable",
    withdraw: isSubmitting ? "Withdrawing…" : "Withdraw",
  };

  const ctaDisabled =
    isSubmitting || (ctaState !== "connect" && ctaState !== "withdraw");

  const invalidateQuotes = () => {
    void queryClient.invalidateQueries({ queryKey: ["easySavings"] });
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
        description: "Connected wallet does not support signing.",
        variant: "destructive",
      });
      return;
    }

    const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
    if (!algorandNetwork) {
      toast({
        title: "Network error",
        description: "This network is not Algorand-compatible.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // `withdraw()` multiplies by token decimals internally (human amount).
      // Unlike `deposit()`, which expects atomic units — do not convert here.
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
        title: "Please Sign Transaction",
        description: `Approve the withdraw in ${walletName}.`,
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
      invalidateQuotes();
      onSuccess?.({
        txId: res.txid,
        kind: "withdraw",
        amount,
        symbol,
      });
      toast({
        title: "Withdraw confirmed",
        description: `Withdrew ${amount} ${symbol}.`,
      });
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const { userRejected, message } = getTransactionErrorFeedback(e);
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
  };

  if (!route) return null;

  return (
    <Dialog
      open={isOpen && !rainbowkitSignDialogSuppressed}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent className={MODAL_SHELL}>
        <div className="max-h-[min(90vh,90dvh)] overflow-y-auto overscroll-contain px-5 pt-10 pb-6 sm:px-7 sm:pb-7">
          {showSuccess ? (
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
          ) : (
            <>
              <DialogHeader className="space-y-2 text-center pr-6">
                <DialogTitle className="text-2xl font-bold">
                  Withdraw
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Withdraw {symbol} from your savings in {route.marketLabel}.
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
                  amountDisabled={isSubmitting}
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
                        ? ` · Supplied ${formatToken(quote.existingDeposit)}`
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
                      Your position
                    </span>
                    <span className="font-medium text-right">
                      {quote.existingDeposit != null &&
                      quote.existingDeposit > 0
                        ? `${formatToken(quote.existingDeposit, 6)} ${symbol}`
                        : "None"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span className="text-muted-foreground shrink-0">
                      Market
                    </span>
                    <span className="font-medium text-right">
                      {route.marketLabel} · {route.asset.symbol}
                    </span>
                  </div>
                </div>

                {quote.error ? (
                  <p className="text-xs text-destructive">{quote.error}</p>
                ) : null}

                <DorkFiButton
                  variant="withdraw"
                  className="w-full h-12"
                  disabled={ctaDisabled}
                  onClick={() => {
                    void handleWithdraw();
                  }}
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
  );
};

export default EasySavingsWithdrawModal;
