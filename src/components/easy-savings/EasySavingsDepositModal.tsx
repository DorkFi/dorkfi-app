import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFundWallet } from "@privy-io/react-auth";
import { base } from "viem/chains";
import type { Address } from "viem";
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
import { requireAlgorandAddressString } from "@/lib/algorand/addressString";
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
import {
  fetchAlgorandUsdcBalance,
  fetchBaseEthBalance,
  fetchBaseUsdcBalance,
  hasEnoughBaseEth,
} from "@/lib/easyStart/baseBalances";
import {
  aramidSendForDestination,
  atomicToUsdc,
  atomicToUsdcString,
  splitAramidFee,
  usdcToAtomic,
} from "@/lib/easyStart/aramid/fees";
import {
  bridgePhaseLabel,
  type EasyStartBridgePhase,
} from "@/components/easy-start/easyStartBridgePhase";

const EasyStartHeadlessBridge = lazy(() =>
  import("@/components/easy-start/EasyStartHeadlessBridge").then((m) => ({
    default: m.EasyStartHeadlessBridge,
  }))
);

const MODAL_SHELL =
  "w-full max-w-[98vw] sm:max-w-md rounded-t-2xl sm:rounded-xl p-0 max-h-[min(90vh,90dvh)] overflow-hidden flex flex-col";

const GAS_TOPUP_USD = "3";

type CtaState =
  | "connect"
  | "enter_amount"
  | "insufficient_balance"
  | "cap_exceeded"
  | "supply";

type FlowPhase = "form" | "gas" | "bridging" | "supplying";

export type SavingsTxSuccessPayload = {
  txId: string;
  kind: "deposit" | "withdraw";
  amount: string;
  symbol: string;
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

function isUsdcRoute(route: SavingsRoute | null): boolean {
  if (!route) return false;
  return route.asset.configKey === "USDC" || route.asset.symbol === "USDC";
}

function EasyStartGasTopUp({ onDone }: { onDone: () => void }) {
  const { fundWallet } = useFundWallet();
  const privy = usePrivyEasyStart();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const address = privy.evmAddress as Address | null;

  const handleFund = async () => {
    if (!address) return;
    setBusy(true);
    try {
      await fundWallet({
        address,
        options: {
          chain: base,
          asset: "native-currency",
          amount: GAS_TOPUP_USD,
          defaultFundingMethod: "card",
          card: { preferredProvider: "moonpay" },
        },
      });
      onDone();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast({
        title: "Couldn’t add network fee",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DorkFiButton
      className="w-full h-12"
      disabled={busy || !address}
      onClick={() => void handleFund()}
    >
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Opening payment…
        </span>
      ) : (
        `Add ~$${GAS_TOPUP_USD} processing fee`
      )}
    </DorkFiButton>
  );
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
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("form");
  const [bridgePhase, setBridgePhase] =
    useState<EasyStartBridgePhase>("preparing");
  const [bridgeAmount, setBridgeAmount] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const pendingSupplyRef = useRef<string | null>(null);
  const supplyLockRef = useRef(false);

  const quote = useEasySavingsQuote({
    networkId,
    route,
    amount,
  });

  const evmAddress = privy.evmAddress as Address | null;
  const enableBaseBalances =
    isOpen && isUsdcRoute(route) && privy.authenticated && Boolean(evmAddress);

  const { data: baseUsdcData, refetch: refetchBaseUsdc } = useQuery({
    queryKey: ["easy-start-base-usdc", evmAddress],
    queryFn: () => fetchBaseUsdcBalance(evmAddress!),
    enabled: enableBaseBalances,
    staleTime: 10_000,
  });

  const { data: baseEthData, refetch: refetchBaseEth } = useQuery({
    queryKey: ["easy-start-base-eth", evmAddress],
    queryFn: () => fetchBaseEthBalance(evmAddress!),
    enabled: enableBaseBalances,
    staleTime: 10_000,
  });

  const rawSymbol = route ? savingsAccountDisplayLabel(route) : "—";
  const symbol = consumerCopy
    ? consumerAssetDisplayLabel(rawSymbol)
    : rawSymbol;
  const logo = route?.asset.logoPath || "/placeholder.svg";
  const amountNum = parseFloat(amount) || 0;

  const algoBalance = quote.walletBalance;
  const baseUsdcNum = (() => {
    if (!enableBaseBalances || !baseUsdcData) return 0;
    const n = Number.parseFloat(baseUsdcData.formatted);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();

  const spendable = useMemo(() => {
    const algo = algoBalance ?? 0;
    if (!enableBaseBalances || baseUsdcNum <= 0) return algo;
    try {
      const dest = splitAramidFee(usdcToAtomic(String(baseUsdcNum)))
        .destinationAmount;
      return algo + atomicToUsdc(dest);
    } catch {
      return algo;
    }
  }, [algoBalance, baseUsdcNum, enableBaseBalances]);

  const depositBridgePreview = useMemo(() => {
    if (!enableBaseBalances || amountNum <= 0) return undefined;
    const algo = algoBalance ?? 0;
    const shortfall = amountNum - algo;
    if (shortfall <= 1e-12) return undefined;
    try {
      const sendAtomic = aramidSendForDestination(
        usdcToAtomic(String(shortfall))
      );
      const { feeAmount } = splitAramidFee(sendAtomic);
      const feeStr = atomicToUsdcString(feeAmount);
      return [
        {
          label: consumerCopy ? "Move fee" : "Bridge fee",
          value: `${feeStr} ${symbol} · ~0.1%`,
        },
        {
          label: consumerCopy ? "Network fee" : "Base network fee",
          value: consumerCopy
            ? "Small ETH on Base (about $3 if you don't have any)"
            : "~ETH on Base (top-up ~$3 if needed)",
        },
      ];
    } catch {
      return undefined;
    }
  }, [
    enableBaseBalances,
    amountNum,
    algoBalance,
    consumerCopy,
    symbol,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    setAmount("");
    setAdvancedOpen(false);
    setIsSubmitting(false);
    setShowSuccess(false);
    setTxId(null);
    setRainbowkitSignDialogSuppressed(false);
    setFlowPhase("form");
    setBridgeAmount(null);
    setFlowError(null);
    pendingSupplyRef.current = null;
    supplyLockRef.current = false;
  }, [isOpen, route?.asset.configKey, route?.poolId]);

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (!route || amountNum <= 0) return "enter_amount";
    if (amountNum > spendable + 1e-12) {
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

  const busy = isSubmitting || flowPhase !== "form";

  const ctaLabel: Record<CtaState, string> = {
    connect: consumerCopy ? "Get Started" : "Connect Wallet",
    enter_amount: "Enter Amount",
    insufficient_balance: "Insufficient Balance",
    cap_exceeded: consumerCopy ? "Limit Reached" : "Supply Cap Reached",
    supply: busy
      ? consumerCopy
        ? "Confirming…"
        : "Supplying…"
      : consumerCopy
        ? "Deposit"
        : "Supply",
  };

  const ctaDisabled =
    busy || (ctaState !== "connect" && ctaState !== "supply");

  const invalidateQuotes = () => {
    void queryClient.invalidateQueries({ queryKey: ["easySavings"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-base-usdc"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-algo-usdc"] });
    void queryClient.invalidateQueries({ queryKey: ["account-info"] });
    void queryClient.invalidateQueries({ queryKey: ["account-balance"] });
  };

  const executeSupply = async (supplyAmount: string) => {
    if (!route || !activeAccount?.address) return;
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

    if (supplyLockRef.current) return;
    supplyLockRef.current = true;
    setFlowPhase("supplying");
    setIsSubmitting(true);

    try {
      let amountInAtomicUnits = new BigNumber(supplyAmount)
        .multipliedBy(10 ** route.asset.decimals)
        .integerValue(BigNumber.ROUND_DOWN)
        .toFixed(0);

      if (amountInAtomicUnits === "0") {
        throw new Error("Amount is too small after decimal conversion.");
      }

      if (isUsdcRoute(route) && activeAccount.address) {
        const algoUsdc = await fetchAlgorandUsdcBalance(activeAccount.address);
        const have = algoUsdc.value;
        const want = BigInt(amountInAtomicUnits);
        if (have < want) {
          if (have <= 0n) {
            throw new Error(
              consumerCopy
                ? "Funds haven’t arrived yet. Try again in a moment."
                : "Algorand USDC is not available yet."
            );
          }
          amountInAtomicUnits = have.toString();
        }
      }

      const result = await deposit(
        route.poolId,
        route.asset.contractId,
        route.asset.tokenStandard,
        amountInAtomicUnits,
        requireAlgorandAddressString(activeAccount.address, "user address"),
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

      const deposited = new BigNumber(amountInAtomicUnits)
        .dividedBy(10 ** route.asset.decimals)
        .toFixed();

      setTxId(res.txid);
      setShowSuccess(true);
      setFlowPhase("form");
      setRainbowkitSignDialogSuppressed(false);
      invalidateQuotes();
      onSuccess?.({
        txId: res.txid,
        kind: "deposit",
        amount: deposited,
        symbol,
      });
      toast({
        title: "Deposit confirmed",
        description: consumerCopy
          ? `Deposited ${deposited} ${symbol}.`
          : `Supplied ${deposited} ${symbol}.`,
      });
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const { userRejected, message } = getTransactionErrorFeedback(e);
      setFlowPhase("form");
      setBridgeAmount(null);
      toast({
        title: userRejected ? "Deposit cancelled" : "Deposit failed",
        description: message,
        variant: "destructive",
        duration: 14_000,
      });
    } finally {
      supplyLockRef.current = false;
      setIsSubmitting(false);
      pendingSupplyRef.current = null;
    }
  };

  const startBridgeThenSupply = (supplyAmount: string, sendHuman: string) => {
    pendingSupplyRef.current = supplyAmount;
    setBridgeAmount(sendHuman);
    setBridgePhase("preparing");
    setFlowError(null);
    setFlowPhase("bridging");
    setIsSubmitting(true);
  };

  const handleSupply = async () => {
    if (ctaState === "connect") {
      onConnectWallet?.();
      return;
    }
    if (ctaState !== "supply" || !route || !activeAccount?.address) return;

    const algo = algoBalance ?? 0;
    const needsBridge =
      isUsdcRoute(route) &&
      privy.authenticated &&
      amountNum > algo + 1e-12;

    if (!needsBridge) {
      await executeSupply(amount);
      return;
    }

    let sendHuman: string;
    try {
      const shortfall = amountNum - algo;
      const sendAtomic = aramidSendForDestination(usdcToAtomic(String(shortfall)));
      const baseAtomic = usdcToAtomic(String(baseUsdcNum));
      if (sendAtomic > baseAtomic) {
        setFlowError(
          consumerCopy
            ? "Not enough available funds after the move fee."
            : "Not enough Base USDC to cover the Aramid fee."
        );
        return;
      }
      sendHuman = atomicToUsdcString(sendAtomic);
    } catch (e: unknown) {
      setFlowError(e instanceof Error ? e.message : "Cannot move funds");
      return;
    }

    const eth = baseEthData ?? (await refetchBaseEth()).data;
    if (!eth || !hasEnoughBaseEth(eth.value)) {
      pendingSupplyRef.current = amount;
      setBridgeAmount(sendHuman);
      setFlowPhase("gas");
      return;
    }

    startBridgeThenSupply(amount, sendHuman);
  };

  const handleBridgeComplete = () => {
    const supplyAmount = pendingSupplyRef.current ?? amount;
    setBridgeAmount(null);
    void executeSupply(supplyAmount);
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setTxId(null);
    setAmount("");
    setAdvancedOpen(false);
    setFlowPhase("form");
    setBridgeAmount(null);
    setFlowError(null);
  };

  if (!route) return null;

  const showFlowStatus = flowPhase === "bridging" || flowPhase === "supplying";

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
            ) : flowPhase === "gas" ? (
              <div className="space-y-4 text-center">
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-2xl font-bold">
                    {consumerCopy ? "Small processing fee" : "Base ETH for gas"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {consumerCopy
                      ? `Moving funds into savings needs a small processing fee (about $${GAS_TOPUP_USD}).`
                      : `Aramid needs a little ETH on Base (~$${GAS_TOPUP_USD}) to move USDC to Algorand.`}
                  </DialogDescription>
                </DialogHeader>
                {flowError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {flowError}
                  </p>
                ) : null}
                <EasyStartGasTopUp
                  onDone={() => {
                    void (async () => {
                      const eth = (await refetchBaseEth()).data;
                      const send = bridgeAmount;
                      const supplyAmount = pendingSupplyRef.current ?? amount;
                      if (eth && hasEnoughBaseEth(eth.value) && send) {
                        startBridgeThenSupply(supplyAmount, send);
                        return;
                      }
                      setFlowError(
                        consumerCopy
                          ? "Fee isn’t showing yet. Wait a moment, then continue."
                          : "ETH is not on Base yet. Wait a moment, then continue."
                      );
                    })();
                  }}
                />
                <DorkFiButton
                  variant="secondary"
                  className="w-full h-12"
                  onClick={() => {
                    void (async () => {
                      const eth = (await refetchBaseEth()).data;
                      const send = bridgeAmount;
                      const supplyAmount = pendingSupplyRef.current ?? amount;
                      if (eth && hasEnoughBaseEth(eth.value) && send) {
                        startBridgeThenSupply(supplyAmount, send);
                      } else {
                        setFlowError(
                          consumerCopy
                            ? "Fee isn’t showing yet. Try again in a moment."
                            : "ETH is not on Base yet."
                        );
                      }
                    })();
                  }}
                >
                  {consumerCopy
                    ? "I already paid the fee — continue"
                    : "I already added ETH — continue"}
                </DorkFiButton>
              </div>
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
                ) : null}
              </div>
            ) : (
              <>
                <DialogHeader className="space-y-2 text-center pr-6">
                  <DialogTitle className="text-2xl font-bold">
                    Deposit
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
                    label={consumerCopy ? `Deposit ${symbol}` : `Supply ${symbol}`}
                    options={[
                      {
                        configKey: route.asset.configKey,
                        symbol,
                        logoPath: route.asset.logoPath,
                        balance: enableBaseBalances ? spendable : quote.walletBalance,
                        balanceUsd:
                          (enableBaseBalances ? spendable : quote.walletBalance) !=
                            null && quote.price != null
                            ? (enableBaseBalances
                                ? spendable
                                : quote.walletBalance!) * quote.price
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
                      if (spendable > 0) {
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
                        {formatToken(enableBaseBalances ? spendable : quote.walletBalance)}{" "}
                        {symbol}
                        {quote.price != null
                          ? ` · ${formatUsdAmount(
                              (enableBaseBalances ? spendable : quote.walletBalance ?? 0) *
                                quote.price
                            )}`
                          : ""}
                        {enableBaseBalances && baseUsdcNum > 0
                          ? consumerCopy
                            ? " · includes funds ready to move"
                            : " · includes Base USDC after bridge fee"
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

                  <SavingsSummary
                    route={route}
                    amount={amount}
                    quote={quote}
                    extraRows={depositBridgePreview}
                  />

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
                            <dt className="text-muted-foreground">Remaining cap</dt>
                            <dd>{formatToken(quote.remainingSupplyCap)}</dd>
                          </div>
                        </dl>
                      ) : null}
                    </>
                  ) : null}

                  {quote.error ? (
                    <p className="text-xs text-destructive">{quote.error}</p>
                  ) : null}
                  {flowError ? (
                    <p className="text-xs text-destructive">{flowError}</p>
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

      {flowPhase === "bridging" && bridgeAmount ? (
        <Suspense fallback={null}>
          <EasyStartHeadlessBridge
            enabled
            amount={bridgeAmount}
            onPhaseChange={(p, err) => {
              setBridgePhase(p);
              if (p === "error") {
                setFlowError(err ?? "Couldn’t move funds");
                setFlowPhase("form");
                setBridgeAmount(null);
                setIsSubmitting(false);
              }
            }}
            onComplete={() => {
              void refetchBaseUsdc();
              handleBridgeComplete();
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
};

export default EasySavingsDepositModal;
