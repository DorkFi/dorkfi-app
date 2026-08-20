import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { waitForConfirmation } from "algosdk";
import BigNumber from "bignumber.js";
import { ChevronDown, Info, Loader2 } from "lucide-react";
import { useDorkFiWalletAdapter } from "@/hooks/useDorkFiWalletAdapter";
import { useEasyStartLogin } from "@/hooks/useEasyStartLogin";
import { useToast } from "@/hooks/use-toast";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
} from "@/config";
import {
  EASY_BORROW_POOL_A_FOLKS_USDC_UI_KEY,
  EASY_BORROW_POOL_D_USDC_UI_KEY,
  listBorrowAssetOptionsForCollateral,
  listUsdcCollateralSupplyOptions,
  resolveBorrowRoute,
  resolveBorrowRoutes,
  type EasyBorrowCollateralOption,
} from "@/services/borrowRouteResolver";
import { borrow, deposit } from "@/services/lendingService";
import algorandService from "@/services/algorandService";
import type { BorrowRoute } from "@/types/easyBorrow";
import {
  useEasyBorrowQuote,
  type CollateralSource,
} from "@/hooks/useEasyBorrowQuote";
import { previewHealthBand } from "@/utils/easyBorrowMath";
import { formatUsdAmount } from "@/lib/utils";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import { invalidateUserPositionRpcCache } from "@/utils/rpcReadCache";
import { useBorrowTransactionHistory } from "@/hooks/useBorrowTransactionHistory";
import BorrowTransactionHistory from "@/components/easy-borrow/BorrowTransactionHistory";
import {
  isRainbowkitXchainWallet,
  withRainbowkitHostDialogDismissed,
} from "@/wallet/xchainSignUi";
import { getTransactionErrorFeedback } from "@/utils/errorUtils";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { consumerAssetDisplayLabel } from "@/services/savingsRouteResolver";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SupplyBorrowCongrats from "@/components/SupplyBorrowCongrats";
import AssetSelector, {
  type AssetSelectorOption,
} from "@/components/easy-borrow/AssetSelector";
import BorrowSlider from "@/components/easy-borrow/BorrowSlider";
import HealthPreview from "@/components/easy-borrow/HealthPreview";
import BorrowSummary from "@/components/easy-borrow/BorrowSummary";
import RatesPanel from "@/components/easy-borrow/RatesPanel";

function formatToken(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatApr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) < 0.01) return "<0.01%";
  return `${n.toFixed(2)}%`;
}

function humanToAtomic(amount: string, decimals: number): string {
  const atomic = new BigNumber(amount)
    .multipliedBy(10 ** decimals)
    .integerValue(BigNumber.ROUND_DOWN)
    .toFixed(0);
  if (atomic === "0") {
    throw new Error("Amount is too small after decimal conversion.");
  }
  return atomic;
}

function b64TxnsToBytes(txns: string[]): Uint8Array[] {
  return txns.map((txn) =>
    Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
  );
}

function lendingTxnsFromResult(
  result:
    | { success: boolean; txId?: string; error?: string }
    | { success: true; txns: string[] },
  action: string
): string[] {
  if (!result.success) {
    throw new Error(
      "error" in result && result.error
        ? String(result.error)
        : `${action} failed to build.`
    );
  }
  if (!("txns" in result) || !result.txns?.length) {
    throw new Error(`No transactions returned for ${action}.`);
  }
  return result.txns;
}

/** Prefer Pool D USDC, then native USDC, then Pool A Folks USDC, then first. */
function preferredBorrowUiKey(
  options: { uiKey: string }[]
): string | undefined {
  if (options.length === 0) return undefined;
  return (
    options.find((o) => o.uiKey === EASY_BORROW_POOL_D_USDC_UI_KEY)?.uiKey ??
    options.find((o) => o.uiKey === "USDC")?.uiKey ??
    options.find((o) => o.uiKey === EASY_BORROW_POOL_A_FOLKS_USDC_UI_KEY)
      ?.uiKey ??
    options[0]?.uiKey
  );
}

function pickDefaultCollateralOption(
  options: EasyBorrowCollateralOption[]
): EasyBorrowCollateralOption | null {
  return (
    options.find((o) => o.uiKey === "USDC") ??
    options.find((o) => o.uiKey === EASY_BORROW_POOL_D_USDC_UI_KEY) ??
    options[0] ??
    null
  );
}

type CtaState =
  | "connect"
  | "enter_amount"
  | "insufficient_balance"
  | "limit_exceeded"
  | "insufficient_liquidity"
  | "too_risky"
  | "review"
  | "supply_borrow"
  | "borrow";

const BorrowCard = () => {
  const { currentNetwork } = useNetwork();
  const networkId = currentNetwork as NetworkId;
  const { activeAccount, signTransactions, activeWallet } =
    useDorkFiWalletAdapter();
  const openEasyStartLogin = useEasyStartLogin();
  const { toast } = useToast();
  const consumerCopy = useConsumerCopy();
  const displaySymbol = (symbol?: string | null) => {
    if (!symbol) return "—";
    return consumerCopy ? consumerAssetDisplayLabel(symbol) : symbol;
  };
  const queryClient = useQueryClient();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [successAmount, setSuccessAmount] = useState("");
  const [, setRainbowkitSignDialogSuppressed] = useState(false);

  const supplyOptions = useMemo(
    () => listUsdcCollateralSupplyOptions(networkId),
    [networkId]
  );

  const [collateralUiKey, setCollateralUiKey] = useState(
    () => pickDefaultCollateralOption(listUsdcCollateralSupplyOptions(networkId))?.uiKey ?? "USDC"
  );
  const selectedCollateral =
    supplyOptions.find((o) => o.uiKey === collateralUiKey) ??
    pickDefaultCollateralOption(supplyOptions);

  useEffect(() => {
    if (supplyOptions.length === 0) return;
    if (supplyOptions.some((o) => o.uiKey === collateralUiKey)) return;
    const preferred = pickDefaultCollateralOption(supplyOptions);
    if (preferred) setCollateralUiKey(preferred.uiKey);
  }, [supplyOptions, collateralUiKey]);

  const [borrowUiKey, setBorrowUiKey] = useState(() => {
    const collateral = pickDefaultCollateralOption(
      listUsdcCollateralSupplyOptions(networkId)
    );
    if (!collateral) return EASY_BORROW_POOL_D_USDC_UI_KEY;
    const opts = listBorrowAssetOptionsForCollateral(
      networkId,
      collateral.collateralConfigKey,
      {
        collateralPoolId: collateral.collateralPoolId,
        collateralContractId: collateral.collateralContractId,
        preferredPoolIds: collateral.preferredPoolIds,
      }
    );
    return preferredBorrowUiKey(opts) ?? opts[0]?.uiKey ?? "WAD";
  });
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [collateralSource, setCollateralSource] =
    useState<CollateralSource>("wallet");

  const borrowOptions = useMemo(() => {
    if (!selectedCollateral) return [];
    return listBorrowAssetOptionsForCollateral(
      networkId,
      selectedCollateral.collateralConfigKey,
      {
        collateralPoolId: selectedCollateral.collateralPoolId,
        collateralContractId: selectedCollateral.collateralContractId,
        preferredPoolIds: selectedCollateral.preferredPoolIds,
      }
    );
  }, [networkId, selectedCollateral]);

  // Keep borrow selection valid for the selected USDC supply market.
  useEffect(() => {
    if (borrowOptions.length === 0) return;
    if (borrowOptions.some((o) => o.uiKey === borrowUiKey)) return;
    const preferred = preferredBorrowUiKey(borrowOptions);
    if (preferred) setBorrowUiKey(preferred);
    else setBorrowUiKey(borrowOptions[0]!.uiKey);
  }, [borrowOptions, borrowUiKey]);

  const selectedBorrowOption =
    borrowOptions.find((o) => o.uiKey === borrowUiKey) ??
    borrowOptions[0] ??
    null;

  const effectiveBorrowUiKey = selectedBorrowOption?.uiKey ?? "";

  const route: BorrowRoute | null = useMemo(() => {
    if (!selectedCollateral || !selectedBorrowOption) return null;
    return resolveBorrowRoute({
      networkId,
      collateralConfigKey: selectedCollateral.collateralConfigKey,
      borrowConfigKey: selectedBorrowOption.borrowConfigKey,
      collateralPoolId: selectedCollateral.collateralPoolId,
      collateralContractId: selectedCollateral.collateralContractId,
      preferredPoolIds: [
        ...selectedCollateral.preferredPoolIds,
        ...(selectedBorrowOption.preferredPoolIds ?? []),
      ],
    });
  }, [networkId, selectedCollateral, selectedBorrowOption]);

  const alternateRoutes = useMemo(() => {
    if (!selectedCollateral || !selectedBorrowOption) return [];
    return resolveBorrowRoutes({
      networkId,
      collateralConfigKey: selectedCollateral.collateralConfigKey,
      borrowConfigKey: selectedBorrowOption.borrowConfigKey,
      collateralPoolId: selectedCollateral.collateralPoolId,
      collateralContractId: selectedCollateral.collateralContractId,
      preferredPoolIds: [
        ...selectedCollateral.preferredPoolIds,
        ...(selectedBorrowOption.preferredPoolIds ?? []),
      ],
    });
  }, [networkId, selectedCollateral, selectedBorrowOption]);
  const quote = useEasyBorrowQuote({
    networkId,
    route,
    collateralAmount:
      collateralSource === "wallet" ? collateralAmount : "0",
    borrowAmount,
    collateralSource,
  });

  const {
    items: borrowTxItems,
    isLoading: borrowTxLoading,
    recordTx,
  } = useBorrowTransactionHistory({
    networkId,
    address: activeAccount?.address,
    poolId: route?.poolId,
  });

  // Prefer existing collateral when the user already has a deposit.
  useEffect(() => {
    if (
      quote.existingDeposit != null &&
      quote.existingDeposit > 0 &&
      (quote.poolGlobal?.totalCollateralValue ?? 0) > 0
    ) {
      setCollateralSource((prev) => (prev === "wallet" ? "existing" : prev));
    }
  }, [quote.existingDeposit, quote.poolGlobal?.totalCollateralValue]);

  const collateralOptions: AssetSelectorOption[] = useMemo(
    () =>
      supplyOptions.map((option) => ({
        configKey: option.uiKey,
        symbol: option.symbol,
        logoPath: option.logoPath,
        balance:
          option.uiKey === selectedCollateral?.uiKey
            ? quote.walletBalance
            : null,
        balanceUsd:
          option.uiKey === selectedCollateral?.uiKey &&
          quote.walletBalance != null &&
          quote.collateralPrice != null
            ? quote.walletBalance * quote.collateralPrice
            : null,
        subtitle: option.subtitle,
      })),
    [
      supplyOptions,
      selectedCollateral?.uiKey,
      quote.walletBalance,
      quote.collateralPrice,
    ]
  );

  const borrowAssetOptions: AssetSelectorOption[] = useMemo(
    () =>
      borrowOptions.map((option) => ({
        configKey: option.uiKey,
        symbol: option.symbol,
        logoPath: option.logoPath,
        balance: null,
        balanceUsd: null,
        subtitle: option.subtitle,
      })),
    [borrowOptions]
  );

  const available = quote.availableToBorrow;
  const borrowNum = parseFloat(borrowAmount) || 0;
  const collateralNum = parseFloat(collateralAmount) || 0;
  const healthBand = previewHealthBand(quote.healthAfter);

  const collateralUsdForLtv = (() => {
    if (collateralSource === "existing") {
      return Math.max(0, quote.collateralUsd);
    }
    const existing = quote.poolGlobal?.totalCollateralValue ?? 0;
    return Math.max(0, existing + quote.collateralUsd);
  })();

  const existingBorrowUsd = quote.poolGlobal?.totalBorrowValue ?? 0;
  const borrowUsdForLtv = Math.max(0, existingBorrowUsd + quote.borrowUsd);
  const ltvPercent =
    collateralUsdForLtv > 0
      ? (borrowUsdForLtv / collateralUsdForLtv) * 100
      : 0;

  const maxLtvPercent =
    quote.collateralFactor != null && Number.isFinite(quote.collateralFactor)
      ? quote.collateralFactor * 100
      : 0;
  const liquidationPercent =
    quote.liquidationThreshold != null &&
    Number.isFinite(quote.liquidationThreshold)
      ? quote.liquidationThreshold * 100
      : 0;

  const setBorrowFromNumber = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) {
      setBorrowAmount("");
      return;
    }
    const d = Math.min(route?.borrow.decimals ?? 6, 6);
    setBorrowAmount(n.toFixed(d).replace(/\.?0+$/, ""));
  };

  const setBorrowFromLtv = (nextLtv: number) => {
    if (
      collateralUsdForLtv <= 0 ||
      quote.borrowPrice == null ||
      quote.borrowPrice <= 0
    ) {
      return;
    }
    const capped =
      maxLtvPercent > 0 ? Math.min(nextLtv, maxLtvPercent) : Math.max(0, nextLtv);
    const targetBorrowUsd = (collateralUsdForLtv * capped) / 100;
    const incrementalUsd = Math.max(0, targetBorrowUsd - existingBorrowUsd);
    const tokens = incrementalUsd / quote.borrowPrice;
    const limited =
      available > 0 ? Math.min(tokens, available) : tokens;
    setBorrowFromNumber(limited);
  };

  const ctaState: CtaState = (() => {
    if (!activeAccount) return "connect";
    if (!route) return "enter_amount";
    if (
      collateralSource === "wallet" &&
      collateralNum <= 0 &&
      !(quote.existingDeposit && quote.existingDeposit > 0 && borrowNum > 0)
    ) {
      if (borrowNum <= 0) return "enter_amount";
    }
    if (borrowNum <= 0) return "enter_amount";
    if (
      collateralSource === "wallet" &&
      quote.walletBalance != null &&
      collateralNum > quote.walletBalance + 1e-12
    ) {
      return "insufficient_balance";
    }
    if (available > 0 && borrowNum > available + 1e-12) {
      return "limit_exceeded";
    }
    if (
      quote.availableLiquidity != null &&
      borrowNum > quote.availableLiquidity + 1e-12
    ) {
      return "insufficient_liquidity";
    }
    if (healthBand === "blocked") return "too_risky";
    if (collateralSource === "wallet" && collateralNum > 0) {
      return "supply_borrow";
    }
    return "borrow";
  })();

  const ctaLabel: Record<CtaState, string> = {
    connect: "Get Started",
    enter_amount: "Enter Amount",
    insufficient_balance: "Insufficient Balance",
    limit_exceeded: "Borrow Limit Exceeded",
    insufficient_liquidity: "Insufficient Liquidity",
    too_risky: "Position Too Risky",
    review: "Review Borrow",
    supply_borrow: isSubmitting
      ? consumerCopy
        ? "Confirming…"
        : "Confirm in wallet…"
      : consumerCopy
        ? "Borrow"
        : "Supply & Borrow",
    borrow: isSubmitting
      ? consumerCopy
        ? "Confirming…"
        : "Confirm in wallet…"
      : "Borrow",
  };

  const ctaDisabled =
    isSubmitting ||
    (ctaState !== "connect" &&
      ctaState !== "supply_borrow" &&
      ctaState !== "borrow" &&
      ctaState !== "review");

  const invalidateQuotes = () => {
    const address = activeAccount?.address?.trim();
    if (address) {
      invalidateUserPositionRpcCache(networkId, address);
    }
    void queryClient.invalidateQueries({ queryKey: ["easyBorrow"] });
    void queryClient.invalidateQueries({ queryKey: ["has-open-borrow"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-borrow-debt"] });
    void queryClient.invalidateQueries({ queryKey: ["easy-start-algo-usdc"] });
  };

  const signAndSend = async (txns: string[], prompt: string) => {
    if (!signTransactions) {
      throw new Error(
        consumerCopy
          ? "Couldn’t confirm. Try again."
          : "Connected wallet does not support signing."
      );
    }
    const algorandNetwork = getAlgorandNetworkFromNetworkId(networkId);
    if (!algorandNetwork) {
      throw new Error(
        consumerCopy
          ? "Please try again."
          : "This network is not Algorand-compatible."
      );
    }
    const walletName = activeWallet?.metadata?.name || "your wallet";
    toast({
      title: consumerCopy ? "Confirm" : "Please Sign Transaction",
      description: consumerCopy
        ? "Confirm this borrow."
        : `${prompt} in ${walletName}.`,
      duration: 12_000,
    });
    const signed = await withRainbowkitHostDialogDismissed({
      wallet: activeWallet,
      setSuppressed: setRainbowkitSignDialogSuppressed,
      leaveOverlayDismissedOnSuccess: true,
      run: () => signTransactions(b64TxnsToBytes(txns)),
    });
    const { algod } =
      await algorandService.initializeClientsForTransactions(algorandNetwork);
    const res = await algod.sendRawTransaction(signed).do();
    await waitForConfirmation(algod, res.txid, 4);
    return res.txid;
  };

  const handleCta = async () => {
    if (ctaState === "connect") {
      void openEasyStartLogin();
      return;
    }
    if (ctaState !== "supply_borrow" && ctaState !== "borrow") {
      setReviewOpen(true);
      return;
    }
    if (!route || !activeAccount?.address) return;
    if (!signTransactions) {
      toast({
        title: "Cannot borrow",
        description: consumerCopy
          ? "Couldn’t confirm. Try again."
          : "Connected wallet does not support signing.",
        variant: "destructive",
      });
      return;
    }

    const willSupply =
      ctaState === "supply_borrow" &&
      collateralSource === "wallet" &&
      collateralNum > 0;

    setIsSubmitting(true);
    setReviewOpen(true);
    try {
      if (willSupply) {
        const depositResult = await deposit(
          route.poolId,
          route.collateral.contractId,
          route.collateral.tokenStandard,
          humanToAtomic(collateralAmount, route.collateral.decimals),
          activeAccount.address,
          networkId
        );
        const supplyTxId = await signAndSend(
          lendingTxnsFromResult(depositResult, "supply"),
          borrowNum > 0
            ? "Step 1 of 2 — approve the supply"
            : "Approve the supply"
        );
        recordTx({
          txId: supplyTxId,
          kind: "supply",
          amount: collateralAmount,
          symbol: route.collateral.symbol,
          poolId: route.poolId,
          assetConfigKey: route.collateral.configKey,
        });
      }

      const borrowResult = await borrow(
        route.poolId,
        route.borrow.contractId,
        route.borrow.tokenStandard,
        humanToAtomic(borrowAmount, route.borrow.decimals),
        activeAccount.address,
        networkId
      );
      const confirmedTxId = await signAndSend(
        lendingTxnsFromResult(borrowResult, "borrow"),
        willSupply ? "Step 2 of 2 — approve the borrow" : "Approve the borrow"
      );

      recordTx({
        txId: confirmedTxId,
        kind: "borrow",
        amount: borrowAmount,
        symbol: route.borrow.symbol,
        poolId: route.poolId,
        assetConfigKey: route.borrow.configKey,
      });

      setTxId(confirmedTxId);
      setSuccessAmount(borrowAmount);
      setShowSuccess(true);
      setRainbowkitSignDialogSuppressed(false);
      invalidateQuotes();
      toast({
        title: "Borrow confirmed",
        description: `Borrowed ${borrowAmount} ${displaySymbol(route.borrow.symbol)}.`,
      });
    } catch (e: unknown) {
      if (isRainbowkitXchainWallet(activeWallet)) {
        setRainbowkitSignDialogSuppressed(false);
      }
      const { userRejected, message } = getTransactionErrorFeedback(e);
      toast({
        title: userRejected ? "Borrow cancelled" : "Borrow failed",
        description: message,
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
    setSuccessAmount("");
    setBorrowAmount("");
    setCollateralAmount("");
    setReviewOpen(false);
  };

  const hasExisting =
    quote.existingDeposit != null && quote.existingDeposit > 0;

  const borrowHint = (() => {
    if (!route) return undefined;
    if (route.isExplicitLpWadRoute) {
      return (
        <>
          Borrow {route.borrow.symbol} via LP market.{" "}
          <span className="text-ocean-teal">Learn more</span>
        </>
      );
    }
    if (route.mechanism === "wad_mint_via_borrow") {
      return (
        <>
          Borrow {route.borrow.symbol} via mint route.{" "}
          <span className="text-ocean-teal">Learn more</span>
        </>
      );
    }
    return (
      <>
        Borrow {route.borrow.symbol} on {route.marketLabel}.{" "}
        <span className="text-ocean-teal">Learn more</span>
      </>
    );
  })();

  return (
    <section className="w-full max-w-5xl mx-auto space-y-5">
      {hasExisting ? (
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {consumerCopy ? "Use" : "Collateral source"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCollateralSource("existing")}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                collateralSource === "existing"
                  ? "border-ocean-teal bg-ocean-teal/10"
                  : "border-border"
              }`}
            >
              <div className="font-medium">
                {consumerCopy ? "Savings already deposited" : "Existing collateral"}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatToken(quote.existingDeposit)}{" "}
                {displaySymbol(route?.collateral.symbol)}{" "}
                {consumerCopy ? "in savings" : "supplied"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCollateralSource("wallet")}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                collateralSource === "wallet"
                  ? "border-ocean-teal bg-ocean-teal/10"
                  : "border-border"
              }`}
            >
              <div className="font-medium">
                {consumerCopy ? "Use available cash" : "Add from wallet"}
              </div>
              <div className="text-xs text-muted-foreground">
                Balance {formatToken(quote.walletBalance)}{" "}
                {displaySymbol(route?.collateral.symbol)}
              </div>
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-stretch">
        <div className="space-y-4 min-w-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <AssetSelector
              card
              label={consumerCopy ? "From savings" : "Supply"}
              headerAction={
                <div className="flex items-center gap-2">
                  <span
                    className="text-muted-foreground"
                    title={
                      consumerCopy
                        ? "Savings you deposit backs this loan."
                        : "Assets you supply become collateral for this borrow."
                    }
                  >
                    <Info className="size-4" />
                  </span>
                  {collateralSource === "existing" ? (
                    <button
                      type="button"
                      onClick={() => setCollateralSource("wallet")}
                      className="text-xs font-semibold text-ocean-teal hover:underline"
                    >
                      Add more +
                    </button>
                  ) : quote.walletBalance != null && quote.walletBalance > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCollateralAmount(String(quote.walletBalance))
                      }
                      className="text-xs font-semibold text-ocean-teal hover:underline"
                    >
                      Add more +
                    </button>
                  ) : null}
                </div>
              }
              options={collateralOptions}
              value={selectedCollateral?.uiKey ?? collateralUiKey}
              onChange={(key) => {
                setCollateralUiKey(key);
                setCollateralAmount("");
                setBorrowAmount("");
                const collateral = supplyOptions.find((o) => o.uiKey === key);
                if (!collateral) return;
                const opts = listBorrowAssetOptionsForCollateral(
                  networkId,
                  collateral.collateralConfigKey,
                  {
                    collateralPoolId: collateral.collateralPoolId,
                    collateralContractId: collateral.collateralContractId,
                    preferredPoolIds: collateral.preferredPoolIds,
                  }
                );
                const preferred = preferredBorrowUiKey(opts);
                if (preferred) setBorrowUiKey(preferred);
                else if (opts[0]) setBorrowUiKey(opts[0].uiKey);
              }}
              amount={
                collateralSource === "existing"
                  ? quote.existingDeposit != null &&
                    Number.isFinite(quote.existingDeposit)
                    ? String(quote.existingDeposit)
                    : ""
                  : collateralAmount
              }
              onAmountChange={setCollateralAmount}
              amountUsd={
                collateralSource === "existing"
                  ? quote.collateralUsd
                  : quote.collateralPrice != null && collateralNum > 0
                    ? collateralNum * quote.collateralPrice
                    : null
              }
              amountDisabled={collateralSource === "existing"}
              footer={
                collateralSource === "wallet" ? (
                  <span>
                    {consumerCopy ? "Available" : "Wallet balance"}:{" "}
                    {formatToken(quote.walletBalance)}{" "}
                    {displaySymbol(route?.collateral.symbol)}
                    {quote.walletBalance != null && quote.collateralPrice != null
                      ? ` · ${formatUsdAmount(quote.walletBalance * quote.collateralPrice)}`
                      : ""}
                  </span>
                ) : (
                  <span>
                    {consumerCopy
                      ? "Using savings already deposited"
                      : "Using existing position"}
                    {quote.poolGlobal && !consumerCopy
                      ? ` · pool collateral ${formatUsdAmount(quote.poolGlobal.totalCollateralValue)}`
                      : ""}
                  </span>
                )
              }
            />

            <AssetSelector
              card
              label="Borrow"
              options={borrowAssetOptions}
              value={effectiveBorrowUiKey}
              onChange={(key) => {
                setBorrowUiKey(key);
                setBorrowAmount("");
              }}
              amount={borrowAmount}
              onAmountChange={setBorrowAmount}
              amountUsd={quote.borrowUsd > 0 ? quote.borrowUsd : null}
              footer={
                <span>
                  Available to borrow: {formatToken(available)}{" "}
                  {displaySymbol(route?.borrow.symbol)}
                  {available > 0 && quote.borrowPrice != null
                    ? ` · ${formatUsdAmount(available * quote.borrowPrice)}`
                    : ""}
                </span>
              }
            />
          </div>

          <BorrowSlider
            ltvPercent={ltvPercent}
            maxLtvPercent={maxLtvPercent}
            liquidationPercent={liquidationPercent}
            onChange={setBorrowFromLtv}
            disabled={
              !route ||
              collateralUsdForLtv <= 0 ||
              quote.borrowPrice == null ||
              quote.borrowPrice <= 0
            }
          />

          {route && (borrowNum > 0 || collateralNum > 0) ? (
            <HealthPreview before={quote.healthBefore} after={quote.healthAfter} />
          ) : null}
        </div>

        <RatesPanel
          borrow={{
            symbol: route?.borrow.symbol ?? selectedBorrowOption?.symbol ?? "—",
            rateLabel: formatApr(quote.borrowAprPercent),
          }}
          supply={{
            symbol:
              route?.collateral.symbol ??
              selectedCollateral?.symbol ??
              "—",
            logoPath: route?.collateral.logoPath,
            rateLabel: formatApr(quote.supplyAprPercent),
          }}
          borrowHint={consumerCopy ? undefined : borrowHint}
        />
      </div>

      {route ? (
        <BorrowSummary
          route={route}
          collateralAmount={
            collateralSource === "existing"
              ? String(quote.existingDeposit ?? 0)
              : collateralAmount
          }
          borrowAmount={borrowAmount}
          quote={quote}
        />
      ) : (
        <p className="text-sm text-destructive">
          {consumerCopy
            ? "Borrowing isn’t available for this savings type right now."
            : "No WAD/USDC borrow route for this collateral on the current network."}
        </p>
      )}

      {!consumerCopy ? (
        <>
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setReviewOpen((v) => !v)}
      >
        Review transaction
        <ChevronDown
          className={`size-4 transition-transform ${reviewOpen ? "rotate-180" : ""}`}
        />
      </button>
      {reviewOpen && route ? (
        <dl className="space-y-1.5 rounded-xl border border-border/50 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Network</dt>
            <dd>{networkId}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Market</dt>
            <dd>
              {route.marketLabel} · {route.collateral.symbol}/{route.borrow.symbol}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Market type</dt>
            <dd>
              {route.isExplicitLpWadRoute
                ? "LP pool"
                : route.mechanism === "wad_mint_via_borrow"
                  ? "WAD mint (A)"
                  : "Lending pool"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Collateral factor</dt>
            <dd>
              {quote.collateralFactor != null
                ? `${(quote.collateralFactor * 100).toFixed(1)}%`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Liquidation threshold</dt>
            <dd>
              {quote.liquidationThreshold != null
                ? `${(quote.liquidationThreshold * 100).toFixed(1)}%`
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">LTV</dt>
            <dd>{ltvPercent.toFixed(2)}%</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Transactions</dt>
            <dd>
              {collateralSource === "wallet" && collateralNum > 0
                ? "Supply then borrow"
                : "Borrow"}
            </dd>
          </div>
          {alternateRoutes.length > 1 ? (
            <div className="pt-1 text-muted-foreground">
              {alternateRoutes.length} matching markets — using{" "}
              {route.marketLabel} by default
            </div>
          ) : null}
        </dl>
      ) : null}

      <button
        type="button"
        className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        Advanced details
        <ChevronDown
          className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
        />
      </button>
      {advancedOpen && route ? (
        <div className="space-y-1.5 rounded-xl border border-border/50 p-3 text-xs">
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Pool ID</dt>
              <dd className="font-mono">{route.poolId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Collateral contract</dt>
              <dd className="font-mono">{route.collateral.contractId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Borrow contract</dt>
              <dd className="font-mono">{route.borrow.contractId}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Supply cap</dt>
              <dd>{formatToken(quote.supplyCapHuman)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Borrow cap</dt>
              <dd>{formatToken(quote.borrowCapHuman)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Oracle (collateral)</dt>
              <dd>
                {quote.collateralPrice != null
                  ? formatUsdAmount(quote.collateralPrice)
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="border-t border-border/50 pt-2">
            <BorrowTransactionHistory
              networkId={networkId}
              items={borrowTxItems}
              isLoading={borrowTxLoading}
            />
          </div>
        </div>
      ) : null}
        </>
      ) : null}

      <DorkFiButton
        className="w-full h-12 sticky bottom-0"
        disabled={ctaDisabled && ctaState !== "connect"}
        onClick={() => {
          void handleCta();
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

      {quote.isLoading ? (
        <p className="text-center text-xs text-muted-foreground">
          Loading…
        </p>
      ) : quote.error ? (
        <p className="text-center text-xs text-destructive">{quote.error}</p>
      ) : null}

      <Dialog
        open={showSuccess && !!route}
        onOpenChange={(open) => {
          if (!open) handleMakeAnother();
        }}
      >
        <DialogContent className="w-full max-w-[98vw] sm:max-w-md rounded-t-2xl sm:rounded-xl p-0 max-h-[min(90vh,90dvh)] overflow-hidden flex flex-col">
          <div className="max-h-[min(90vh,90dvh)] overflow-y-auto overscroll-contain px-5 pt-10 pb-6 sm:px-7 sm:pb-7">
            <DialogHeader className="sr-only">
              <DialogTitle>Borrow confirmed</DialogTitle>
              <DialogDescription>
                Your borrow completed successfully.
              </DialogDescription>
            </DialogHeader>
            {route ? (
              <SupplyBorrowCongrats
                transactionType="borrow"
                asset={displaySymbol(route.borrow.symbol)}
                assetIcon={route.borrow.logoPath}
                amount={successAmount}
                onViewTransaction={() => {
                  if (!txId) return;
                  window.open(
                    getExplorerTransactionUrl(networkId, txId),
                    "_blank",
                    "noopener,noreferrer"
                  );
                }}
                onGoToPortfolio={() => {
                  window.location.href = "/portfolio";
                }}
                onMakeAnother={handleMakeAnother}
                onClose={handleMakeAnother}
                viewTransactionDisabled={!txId}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default BorrowCard;
