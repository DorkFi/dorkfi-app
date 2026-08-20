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
import { useToast } from "@/hooks/use-toast";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
} from "@/config";
import {
  fetchUserWalletBalance,
  repay,
  repayAll,
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
import { consumerAssetDisplayLabel } from "@/services/savingsRouteResolver";
import {
  formatBorrowApyLabel,
  isAccruedDisplayable,
  type EasyStartBorrowPosition,
} from "@/hooks/useEasyStartBorrowDebt";

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

  const [amount, setAmount] = useState("");
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

  const walletBalance = walletQuery.data ?? null;
  const walletBalanceReady = !walletQuery.isLoading && walletBalance != null;
  const maxRepay = (() => {
    if (debt <= 0 || walletBalance == null) return 0;
    return Math.max(0, Math.min(debt, walletBalance));
  })();

  useEffect(() => {
    if (!isOpen) return;
    setAmount("");
    setIsSubmitting(false);
    setShowSuccess(false);
    setTxId(null);
    setRainbowkitSignDialogSuppressed(false);
  }, [isOpen, position?.id]);

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (debt <= 1e-12) return "no_debt";
    if (!position || amountNum <= 0) return "enter_amount";
    if (!walletBalanceReady) return "enter_amount";
    if (amountNum > walletBalance + 1e-8) {
      return "insufficient_balance";
    }
    if (amountNum > debt + 1e-8) return "insufficient_balance";
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
      : "Repay",
  };

  const ctaDisabled =
    isSubmitting || (ctaState !== "connect" && ctaState !== "repay");

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

  const handleRepay = async () => {
    if (ctaState === "connect") {
      onConnectWallet?.();
      return;
    }
    if (ctaState !== "repay" || !position || !market || !activeAccount?.address) {
      return;
    }
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

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setTxId(null);
    setAmount("");
  };

  if (!position) return null;

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

                {walletBalance != null &&
                walletBalance + 1e-8 < debt &&
                debt > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {consumerCopy
                      ? `You need ${symbol} available to repay. This does not pull from savings.`
                      : `You need ${symbol} in your Algorand wallet to repay. This does not pull from savings collateral.`}
                  </p>
                ) : null}

                <DorkFiButton
                  variant="borrow"
                  className="w-full h-12"
                  disabled={ctaDisabled}
                  onClick={() => {
                    void handleRepay();
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

export default EasyBorrowRepayModal;
