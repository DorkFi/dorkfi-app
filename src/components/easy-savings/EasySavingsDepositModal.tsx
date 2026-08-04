import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
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
} from "@/services/savingsRouteResolver";
import type { SavingsRoute } from "@/types/easySavings";
import { formatUsdAmount, cn } from "@/lib/utils";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";

const MODAL_SHELL =
  "w-full max-w-[98vw] sm:max-w-md rounded-t-2xl sm:rounded-xl p-0 max-h-[min(90vh,90dvh)] overflow-hidden flex flex-col";

type CtaState =
  | "connect"
  | "enter_amount"
  | "insufficient_balance"
  | "cap_exceeded"
  | "supply";

type EasySavingsDepositModalProps = {
  isOpen: boolean;
  onClose: () => void;
  route: SavingsRoute | null;
  networkId: NetworkId;
  isHighYield?: boolean;
  onConnectWallet?: () => void;
  onSuccess?: (txId: string) => void;
};

function formatToken(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
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
  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
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

  const symbol = route ? savingsAccountDisplayLabel(route) : "—";
  const logo = route?.asset.logoPath || "/placeholder.svg";
  const amountNum = parseFloat(amount) || 0;

  useEffect(() => {
    if (!isOpen) return;
    setAmount("");
    setAdvancedOpen(false);
    setIsSubmitting(false);
    setShowSuccess(false);
    setTxId(null);
    setRainbowkitSignDialogSuppressed(false);
  }, [isOpen, route?.asset.configKey, route?.poolId]);

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (!route || amountNum <= 0) return "enter_amount";
    if (
      quote.walletBalance != null &&
      amountNum > quote.walletBalance + 1e-12
    ) {
      return "insufficient_balance";
    }
    if (
      quote.remainingSupplyCap != null &&
      amountNum > quote.remainingSupplyCap + 1e-12
    ) {
      return "cap_exceeded";
    }
    return "supply";
  })();

  const ctaLabel: Record<CtaState, string> = {
    connect: "Connect Wallet",
    enter_amount: "Enter Amount",
    insufficient_balance: "Insufficient Balance",
    cap_exceeded: "Supply Cap Reached",
    supply: isSubmitting ? "Supplying…" : "Supply",
  };

  const ctaDisabled =
    isSubmitting || (ctaState !== "connect" && ctaState !== "supply");

  const invalidateQuotes = () => {
    void queryClient.invalidateQueries({ queryKey: ["easySavings"] });
  };

  const handleSupply = async () => {
    if (ctaState === "connect") {
      onConnectWallet?.();
      return;
    }
    if (ctaState !== "supply" || !route || !activeAccount?.address) return;
    if (!signTransactions) {
      toast({
        title: "Cannot deposit",
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
      const amountInAtomicUnits = new BigNumber(amount)
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
        title: "Please Sign Transaction",
        description: `Approve the deposit in ${walletName}.`,
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
      onSuccess?.(res.txid);
      toast({
        title: "Deposit confirmed",
        description: `Supplied ${amount} ${symbol}.`,
      });
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const msg = e instanceof Error ? e.message : "Deposit failed.";
      toast({
        title: "Deposit failed",
        description: msg,
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
    setAdvancedOpen(false);
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
          ) : (
            <>
              <DialogHeader className="space-y-2 text-center pr-6">
                <DialogTitle className="text-2xl font-bold">
                  Deposit
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Supply {symbol} to earn{" "}
                  {quote.supplyApyPercent != null
                    ? `${quote.supplyApyPercent.toFixed(2)}%`
                    : "—"}{" "}
                  APY in {route.marketLabel}.
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
                  label={`Supply ${symbol}`}
                  options={[
                    {
                      configKey: route.asset.configKey,
                      symbol,
                      logoPath: route.asset.logoPath,
                      balance: quote.walletBalance,
                      balanceUsd:
                        quote.walletBalance != null && quote.price != null
                          ? quote.walletBalance * quote.price
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
                  amountDisabled={isSubmitting}
                  showMax
                  onMax={() => {
                    if (
                      quote.walletBalance != null &&
                      quote.walletBalance > 0
                    ) {
                      let max = quote.walletBalance;
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
                      Wallet: {formatToken(quote.walletBalance)} {symbol}
                      {quote.walletBalance != null && quote.price != null
                        ? ` · ${formatUsdAmount(quote.walletBalance * quote.price)}`
                        : ""}
                      {quote.existingDeposit != null &&
                      quote.existingDeposit > 0
                        ? ` · Supplied ${formatToken(quote.existingDeposit)}`
                        : ""}
                      {isHighYield ? " · Pooled asset" : ""}
                    </span>
                  }
                />

                <SavingsSummary route={route} amount={amount} quote={quote} />

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
                      <dt className="text-muted-foreground">Remaining cap</dt>
                      <dd>{formatToken(quote.remainingSupplyCap)}</dd>
                    </div>
                  </dl>
                ) : null}

                {quote.error ? (
                  <p className="text-xs text-destructive">{quote.error}</p>
                ) : null}

                <DorkFiButton
                  className="w-full h-12"
                  disabled={ctaDisabled}
                  onClick={() => {
                    void handleSupply();
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

export default EasySavingsDepositModal;
