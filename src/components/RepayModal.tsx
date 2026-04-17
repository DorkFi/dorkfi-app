import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocaleNumberInput } from "@/components/ui/LocaleNumberInput";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { InfoIcon, ChevronDown, ChevronUp } from "lucide-react";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import { formatRelativeTime } from "@/utils/timeUtils";
import { useNetwork } from "@/contexts/NetworkContext";
import { calculateBorrowAPY } from "@/utils/apyCalculations";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PoolCollateralMarketRow } from "@/utils/poolCollateralMarketRows";
import type { NetworkId } from "@/config";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import {
  buildLiquidationThresholdSummaryForDeposit,
  DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX,
  estimatePoolHealthAfterRepay,
} from "@/utils/depositModalPoolHealthEstimate";

interface RepayModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenIcon: string;
  poolId?: string; // For dropdown selection when multiple borrows exist
  network?: string; // Network ID for transaction viewing / dropdown selection
  currentBorrow: number;
  accruedInterest: number;
  walletBalance: number;
  marketStats: {
    borrowAPY: number;
    liquidationMargin: number;
    healthFactor: number | null;
    currentLTV: number;
    tokenPrice: number;
    collateralFactor?: number;
    totalDeposits?: number;
    totalBorrows?: number;
    apyParameters?: { borrowRateBps: number; slopeBps: number; reserveFactorBps: number };
    isSToken?: boolean;
  };
  lastUpdateTime?: number; // Market's last update time (when market indices were updated)
  userLastUpdateTime?: number; // User's last update time (when user last interacted with market)
  onSubmit: (amount: string, isRepayAll?: boolean) => Promise<string>; // Returns transaction ID, isRepayAll indicates if repayAll should be used
  /** When provided, show asset dropdown like Supply/Withdraw modals */
  availableAssets?: {
    asset: string;
    icon: string;
    value?: number;
    poolId?: string;
    network?: string;
  }[];
  onSelectAsset?: (asset: string, poolId?: string, network?: string) => void;
  /** Per-pool user totals (USD) for est. health; undefined = loading */
  poolGlobalUserData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  poolCollateralMarkets?: PoolCollateralMarketRow[];
  /** Percent 0–100; used with pool collateral rows for min LT (borrow modal parity). */
  liquidationThresholdPercent?: number | null;
}

const RepayModal = ({
  isOpen,
  onClose,
  tokenSymbol,
  tokenIcon,
  poolId,
  network,
  currentBorrow,
  accruedInterest,
  walletBalance,
  marketStats,
  lastUpdateTime,
  userLastUpdateTime,
  onSubmit,
  availableAssets,
  onSelectAsset,
  poolGlobalUserData,
  poolCollateralMarkets,
  liquidationThresholdPercent,
}: RepayModalProps) => {
  const [amount, setAmount] = useState<number | "">("");
  const [fiatValue, setFiatValue] = useState(0);
  const { currentNetwork } = useNetwork();
  const networkToUse = network || currentNetwork;
  const { price: oracleTokenPrice } = useTokenPrice(tokenSymbol, networkToUse);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [isRepayAll, setIsRepayAll] = useState(false);
  const [workflowStep, setWorkflowStep] = useState<"amount" | "confirm">(
    "amount"
  );
  const [expandedDetails, setExpandedDetails] = useState<{
    borrowAPY: boolean;
    accruedInterest: boolean;
    liquidationMargin: boolean;
    healthFactor: boolean;
    ltv: boolean;
    collateralFactor: boolean;
  }>({
    borrowAPY: false,
    accruedInterest: false,
    liquidationMargin: false,
    healthFactor: false,
    ltv: false,
    collateralFactor: false,
  });

  // Get health factor label and color based on ranges
  const getHealthFactorLabel = (
    healthFactor: number | null
  ): { label: string; color: string } => {
    if (healthFactor === null) {
      return { label: "N/A", color: "text-gray-400 dark:text-gray-500" };
    }
    if (healthFactor >= 3.0) {
      return { label: "Safe", color: "text-green-600 dark:text-green-400" };
    } else if (healthFactor >= 1.5) {
      return { label: "Moderate", color: "text-blue-600 dark:text-blue-400" };
    } else if (healthFactor >= 1.2) {
      return {
        label: "Caution",
        color: "text-yellow-600 dark:text-yellow-400",
      };
    } else if (healthFactor >= 1.0) {
      return {
        label: "Critical",
        color: "text-orange-600 dark:text-orange-400",
      };
    } else {
      return { label: "Liquidatable", color: "text-red-600 dark:text-red-400" };
    }
  };

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setIsLoading(false);
      setTransactionId(null);
      setIsRepayAll(false);
      setWorkflowStep("amount");
      setExpandedDetails({
        borrowAPY: false,
        accruedInterest: false,
        liquidationMargin: false,
        healthFactor: false,
        ltv: false,
        collateralFactor: false,
      });
    }
  }, [isOpen]);

  const toggleDetail = (key: keyof typeof expandedDetails) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    if (amount !== "" && typeof amount === "number") {
      setFiatValue(amount * marketStats.tokenPrice);
    } else {
      setFiatValue(0);
    }
  }, [amount, marketStats.tokenPrice]);

  const maxRepayAmount = Math.min(currentBorrow, walletBalance);

  const handleMaxClick = () => {
    const roundedMax = Math.round(maxRepayAmount * 1000000) / 1000000;
    setAmount(roundedMax);
    const roundedCurrentBorrow = Math.round(currentBorrow * 1000000) / 1000000;
    setIsRepayAll(roundedMax === roundedCurrentBorrow);
  };

  const handleConfirmRepay = async () => {
    const numAmount = amount !== "" && typeof amount === "number" ? amount : 0;
    const roundedAmount = Math.round(numAmount * 1000000) / 1000000;
    const roundedCurrentBorrow = Math.round(currentBorrow * 1000000) / 1000000;
    const shouldUseRepayAll = roundedAmount === roundedCurrentBorrow;

    const amountStr = amount !== "" ? amount.toString() : "0";
    console.log(`Repay ${amountStr} ${tokenSymbol}${shouldUseRepayAll ? " (repayAll)" : ""}`);

    try {
      setIsLoading(true);

      const txId = await onSubmit(amountStr, shouldUseRepayAll);
      setTransactionId(txId);

      // Only show success modal after transaction is actually completed
      setShowSuccess(true);
    } catch (error) {
      console.error("Repay transaction failed:", error);
      // You might want to show an error message to the user here
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewTransaction = () => {
    if (!transactionId) {
      throw new Error("Transaction ID not found");
    }
    window.open(
      getExplorerTransactionUrl(networkToUse as NetworkId, transactionId),
      "_blank"
    );
  };

  const handleGoToPortfolio = () => {
    onClose();
    window.location.href = "/";
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setAmount("");
    setFiatValue(0);
    setTransactionId(null);
    setWorkflowStep("amount");
  };

  const numAmount = amount !== "" && typeof amount === "number" ? amount : 0;
  const roundedAmount = Math.round(numAmount * 1000000) / 1000000;
  const roundedMaxRepay = Math.round(maxRepayAmount * 1000000) / 1000000;
  const isValidAmount =
    amount !== "" && numAmount > 0 && roundedAmount <= roundedMaxRepay;

  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  /** Principal portion of debt; total owed = currentBorrow = principal + accrued (see lendingService index split). */
  const principalBorrowExclInterest = Math.max(
    0,
    round6(currentBorrow - accruedInterest)
  );
  const estimatedRemainingBorrow = Math.max(
    0,
    round6(currentBorrow - numAmount)
  );

  const handleContinueToConfirm = () => {
    if (!isValidAmount) return;
    setWorkflowStep("confirm");
  };

  const hfTokenPrice = useMemo(() => {
    if (oracleTokenPrice > 0 && Number.isFinite(oracleTokenPrice)) {
      return oracleTokenPrice;
    }
    return marketStats.tokenPrice > 0 &&
      Number.isFinite(marketStats.tokenPrice)
      ? marketStats.tokenPrice
      : 0;
  }, [oracleTokenPrice, marketStats.tokenPrice]);

  const liquidationSummaryForRepay = useMemo(
    () =>
      buildLiquidationThresholdSummaryForDeposit(
        liquidationThresholdPercent ?? undefined,
        poolCollateralMarkets,
        poolId
      ),
    [liquidationThresholdPercent, poolCollateralMarkets, poolId]
  );

  const estimatedPoolHealthMeta = useMemo(() => {
    if (poolGlobalUserData == null || !liquidationSummaryForRepay) {
      return {
        value: undefined as number | null | undefined,
        deltaPercent: undefined as number | null | undefined,
      };
    }
    const meta = estimatePoolHealthAfterRepay(
      poolGlobalUserData,
      liquidationSummaryForRepay,
      numAmount,
      hfTokenPrice
    );
    if (!meta) {
      return {
        value: undefined as number | null | undefined,
        deltaPercent: undefined as number | null | undefined,
      };
    }
    return { value: meta.value, deltaPercent: meta.deltaPercent };
  }, [
    poolGlobalUserData,
    liquidationSummaryForRepay,
    numAmount,
    hfTokenPrice,
  ]);

  const showPoolHealthEstimate =
    poolGlobalUserData != null &&
    liquidationSummaryForRepay != null &&
    estimatedPoolHealthMeta.value !== undefined;

  const healthFactorDisplayValue: number | null = showPoolHealthEstimate
    ? estimatedPoolHealthMeta.value ?? null
    : marketStats.healthFactor;

  const healthFactorLabel = getHealthFactorLabel(healthFactorDisplayValue);

  const repayPoolHealthLoading =
    poolGlobalUserData === undefined && Boolean(poolId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card dark:bg-slate-900 rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl max-w-[95vw] md:max-w-lg lg:max-w-4xl h-[90vh] md:h-auto md:max-h-[85vh] overflow-hidden flex flex-col px-0 py-0">
        {showSuccess ? (
          <div className="p-6 overflow-y-auto">
            <SupplyBorrowCongrats
              transactionType="repay"
              asset={tokenSymbol}
              assetIcon={tokenIcon}
              amount={amount !== "" ? amount.toString() : ""}
              onViewTransaction={handleViewTransaction}
              onGoToPortfolio={handleGoToPortfolio}
              onMakeAnother={handleMakeAnother}
              onClose={onClose}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="sticky top-0 z-20 bg-card dark:bg-slate-900 pt-6 px-6 md:px-8 lg:px-10 pb-4 border-b border-gray-200/50 dark:border-slate-700/50">
              <DialogHeader className="pb-0">
                {availableAssets &&
                availableAssets.length > 0 &&
                onSelectAsset ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center justify-center gap-3 pb-2 mt-1 h-14">
                      <Select
                        value={`${tokenSymbol}-${poolId ?? ""}-${network ?? ""}`}
                        onValueChange={(value) => {
                          const selected = availableAssets.find(
                            (a) =>
                              `${a.asset}-${a.poolId ?? ""}-${a.network ?? ""}` ===
                              value
                          );
                          if (selected) {
                            onSelectAsset(
                              selected.asset,
                              selected.poolId,
                              selected.network
                            );
                          }
                        }}
                      >
                        <SelectTrigger className="w-auto min-w-0 h-auto bg-transparent border-none p-0 hover:bg-transparent focus:ring-0 focus:ring-offset-0 justify-center [&>svg:last-child]:!hidden">
                          <div className="flex items-center gap-2 shrink-0">
                            <img
                              src={tokenIcon}
                              alt={tokenSymbol}
                              className="w-14 h-14 rounded-full ring-2 ring-whale-gold/20 dark:ring-whale-gold/30"
                            />
                            <span className="flex items-center gap-1 text-2xl font-bold text-slate-800 dark:text-white">
                              {tokenSymbol}
                              <ChevronDown className="h-4 w-4 text-slate-800 dark:text-white" />
                            </span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {availableAssets.map((a) => (
                            <SelectItem
                              key={`${a.asset}-${a.poolId ?? ""}-${a.network ?? ""}`}
                              value={`${a.asset}-${a.poolId ?? ""}-${a.network ?? ""}`}
                            >
                              <span className="flex items-center gap-2">
                                <img
                                  src={a.icon}
                                  alt={a.asset}
                                  className="h-5 w-5 rounded-full"
                                />
                                <span>{a.asset}</span>
                                {a.value != null && (
                                  <span className="text-xs text-muted-foreground">
                                    —{" "}
                                    {a.value.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      $
                      {marketStats.tokenPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-4">
                    <img
                      src={tokenIcon}
                      alt={tokenSymbol}
                      className="w-14 h-14 rounded-full ring-2 ring-whale-gold/20 dark:ring-whale-gold/30"
                    />
                    <div className="flex flex-col items-start">
                      <DialogTitle className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">
                        Repay {tokenSymbol}
                      </DialogTitle>
                      <span className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        $
                        {marketStats.tokenPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain pt-2 px-6 md:px-8 lg:px-10 pb-6 md:pb-8 touch-pan-y">
              <div className="flex flex-col lg:flex-row lg:gap-8 space-y-6 lg:space-y-0">
                {/* Left Column: Input Form */}
                <div className="flex-1 space-y-6 min-w-0">
                  {workflowStep === "amount" ? (
                    <>
                      <div className="space-y-3">
                        <Label
                          htmlFor="amount"
                          className="text-sm font-medium text-slate-600 dark:text-slate-300"
                        >
                          Amount
                        </Label>
                        <div className="relative">
                          <LocaleNumberInput
                            id="amount"
                            placeholder="0.0"
                            autoFocus
                            value={amount}
                            onChange={(v) => {
                              setAmount(v ?? "");
                              setIsRepayAll(false);
                            }}
                            formatOptions={{ maximumFractionDigits: 6 }}
                            className="bg-white/80 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white pr-16 text-lg h-12"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleMaxClick}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-whale-gold hover:bg-whale-gold/10 h-8 px-3"
                          >
                            MAX
                          </Button>
                        </div>
                        {fiatValue > 0 && (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            ≈ $
                            {fiatValue.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                        <div className="pt-2">
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-row justify-between gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                  Wallet Balance
                                </p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words">
                                  {walletBalance.toLocaleString()}{" "}
                                  {tokenSymbol}
                                  <span className="text-slate-500 dark:text-slate-400 ml-1">
                                    ($
                                    {(
                                      walletBalance * marketStats.tokenPrice
                                    ).toLocaleString()}
                                    )
                                  </span>
                                </p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                  Total owed
                                </p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words">
                                  {currentBorrow.toLocaleString()}{" "}
                                  {tokenSymbol}
                                  <span className="text-slate-500 dark:text-slate-400 ml-1">
                                    ($
                                    {(
                                      currentBorrow * marketStats.tokenPrice
                                    ).toLocaleString()}
                                    )
                                  </span>
                                </p>
                              </div>
                            </div>
                            {accruedInterest > 0 && (
                              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                                  Accrued Interest
                                </p>
                                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium break-words">
                                  {accruedInterest.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })}{" "}
                                  {tokenSymbol}
                                  <span className="text-amber-600 dark:text-amber-400 ml-1">
                                    ($
                                    {(
                                      accruedInterest * marketStats.tokenPrice
                                    ).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                    )
                                  </span>
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                                  Included in total owed above. You&apos;ll see a
                                  full breakdown on the next step before signing.
                                  {userLastUpdateTime && (
                                    <span className="block mt-1 text-blue-500 dark:text-blue-400">
                                      Last interaction:{" "}
                                      {formatRelativeTime(userLastUpdateTime)}
                                    </span>
                                  )}
                                  {lastUpdateTime && (
                                    <span className="block mt-1 text-amber-500 dark:text-amber-400">
                                      Last updated:{" "}
                                      {formatRelativeTime(lastUpdateTime)}
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={handleContinueToConfirm}
                        disabled={!isValidAmount || isLoading}
                        className="w-full font-semibold h-12 bg-whale-gold hover:bg-whale-gold/90 text-black disabled:opacity-50 disabled:cursor-not-allowed lg:mt-auto"
                      >
                        Continue
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Confirm repayment
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Review principal, interest, and your estimated
                          remaining borrow for this market before you sign.
                        </p>
                        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                          <div className="flex justify-between gap-3 px-3 py-2.5">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Borrow (excl. accrued interest)
                            </span>
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 text-right tabular-nums">
                              {principalBorrowExclInterest.toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6,
                                }
                              )}{" "}
                              {tokenSymbol}
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                ≈ $
                                {(
                                  principalBorrowExclInterest *
                                  marketStats.tokenPrice
                                ).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 px-3 py-2.5">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Accrued interest
                            </span>
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 text-right tabular-nums">
                              {accruedInterest.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })}{" "}
                              {tokenSymbol}
                              <span className="block text-[10px] text-amber-600/90 dark:text-amber-400/90 font-normal">
                                ≈ $
                                {(
                                  accruedInterest * marketStats.tokenPrice
                                ).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 px-3 py-2.5">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Payment
                            </span>
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 text-right tabular-nums">
                              {numAmount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })}{" "}
                              {tokenSymbol}
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                ≈ $
                                {(
                                  numAmount * marketStats.tokenPrice
                                ).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 px-3 py-2.5 bg-white/60 dark:bg-slate-900/30">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                              Est. remaining borrow
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white text-right tabular-nums">
                              {estimatedRemainingBorrow.toLocaleString(
                                undefined,
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6,
                                }
                              )}{" "}
                              {tokenSymbol}
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                ≈ $
                                {(
                                  estimatedRemainingBorrow *
                                  marketStats.tokenPrice
                                ).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 lg:mt-auto">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setWorkflowStep("amount")}
                          disabled={isLoading}
                          className="w-full sm:flex-1 h-12 border-slate-300 dark:border-slate-600"
                        >
                          Back
                        </Button>
                        <Button
                          type="button"
                          onClick={handleConfirmRepay}
                          disabled={isLoading}
                          className="w-full sm:flex-1 h-12 font-semibold bg-whale-gold hover:bg-whale-gold/90 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? "Processing..." : "Confirm repayment"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column: Stats Card */}
                <div className="lg:w-80 lg:flex-shrink-0">
                  <Card className="bg-white/80 dark:bg-slate-800 border-gray-200 dark:border-slate-700 lg:sticky lg:top-4">
                    <CardContent className="p-3 md:p-5 lg:p-6">
                      <h3 className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 md:mb-4">
                        Position Details
                      </h3>
                      <div className="space-y-2 md:space-y-4">
                        {/* Borrow APY (adjusted after repay when amount entered) */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => toggleDetail("borrowAPY")}
                              className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                            >
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                Borrow APY
                              </span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.borrowAPY ? (
                                <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              )}
                            </button>
                            {(() => {
                              const repayAmount = numAmount > 0 ? numAmount : 0;
                              const params = marketStats.apyParameters;
                              const totalSupply = Number(marketStats.totalDeposits) || 0;
                              const totalBorrow = Number(marketStats.totalBorrows) || 0;
                              const hasTotals = Number.isFinite(totalSupply) && Number.isFinite(totalBorrow) && totalSupply > 0 && totalBorrow > 0;
                              if (repayAmount > 0 && params && hasTotals) {
                                const newTotalBorrow = Math.max(0, totalBorrow - repayAmount);
                                const result = calculateBorrowAPY(
                                  { borrowRate: params.borrowRateBps, slope: params.slopeBps, reserveFactor: params.reserveFactorBps },
                                  { totalScaledDeposits: totalSupply, totalScaledBorrows: newTotalBorrow, lastUpdateTime: Date.now() },
                                  marketStats.isSToken ?? false
                                );
                                const currentAPY = marketStats.borrowAPY;
                                // After repay, borrow APY should go down (lower utilization). If result is higher, treat as data/unit mismatch and show current.
                                const adjustedAPY = result.apy <= currentAPY ? result.apy : currentAPY;
                                const changePercent = currentAPY > 0 ? ((adjustedAPY - currentAPY) / currentAPY) * 100 : 0;
                                const showChange = Math.abs(changePercent) > 0.01;
                                return (
                                  <div className="text-right">
                                    <div className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400">
                                      {Math.max(0, adjustedAPY).toFixed(2)}%
                                    </div>
                                    <div className={`text-xs flex items-center justify-end gap-1 ${
                                      showChange
                                        ? (changePercent > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400")
                                        : "text-slate-500 dark:text-slate-400"
                                    }`}>
                                      {showChange ? (
                                        <>
                                          <span>{changePercent > 0 ? "↑" : "↓"}</span>
                                          <span>{changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%</span>
                                        </>
                                      ) : (
                                        <span>after repay</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <span className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400">
                                  {marketStats.borrowAPY.toFixed(2)}%
                                </span>
                              );
                            })()}
                          </div>
                          {expandedDetails.borrowAPY && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {numAmount > 0
                                  ? "Borrow APY after your repayment. It typically goes down (lower utilization = lower rate)."
                                  : `Annual percentage yield for borrowing ${tokenSymbol}. This is the interest rate you'll pay on your borrowed amount.`}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Accrued Interest */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => toggleDetail("accruedInterest")}
                              className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                            >
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                Accrued Interest
                              </span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.accruedInterest ? (
                                <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              )}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-amber-600 dark:text-amber-400">
                              {accruedInterest > 0
                                ? `${accruedInterest.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })} ${tokenSymbol}`
                                : `0 ${tokenSymbol}`}
                            </span>
                          </div>
                          {expandedDetails.accruedInterest && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                The interest that has accrued on your borrow
                                since you borrowed. This is included in your
                                current borrow amount.
                              </p>
                              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                <p className="font-semibold">
                                  Current Borrow:{" "}
                                  {currentBorrow.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })}{" "}
                                  {tokenSymbol}
                                </p>
                                <p className="text-amber-600 dark:text-amber-400">
                                  Accrued Interest:{" "}
                                  {accruedInterest.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6,
                                  })}{" "}
                                  {tokenSymbol}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400">
                                  USD Value: $
                                  {(
                                    accruedInterest * marketStats.tokenPrice
                                  ).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                                {lastUpdateTime && (
                                  <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs">
                                    Last updated:{" "}
                                    {formatRelativeTime(lastUpdateTime)}
                                  </p>
                                )}
                                {userLastUpdateTime && (
                                  <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs">
                                    Last interaction:{" "}
                                    {formatRelativeTime(userLastUpdateTime)}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Liquidation Margin */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => toggleDetail("liquidationMargin")}
                              className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                            >
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                Liquidation Margin
                              </span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.liquidationMargin ? (
                                <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              )}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-teal-600 dark:text-teal-400">
                              {marketStats.liquidationMargin.toFixed(2)}%
                            </span>
                          </div>
                          {expandedDetails.liquidationMargin && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                How much safety margin you have before your
                                position can be liquidated. Higher values mean
                                more safety.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Health factor: pool-level estimate (borrow modal parity) or portfolio aggregate */}
                        <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                          <div className="flex justify-between items-start gap-2">
                            <button
                              type="button"
                              onClick={() => toggleDetail("healthFactor")}
                              className="flex items-start gap-1.5 md:gap-2 hover:opacity-70 transition-opacity text-left min-w-0"
                            >
                              <div className="flex flex-col items-start min-w-0">
                                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1">
                                  {repayPoolHealthLoading
                                    ? "Pool health (est.)"
                                    : showPoolHealthEstimate
                                      ? "Pool health (est.)"
                                      : "Health factor"}
                                  {!repayPoolHealthLoading &&
                                    !showPoolHealthEstimate && (
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                        (portfolio)
                                      </span>
                                    )}
                                  {showPoolHealthEstimate && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className="inline-flex"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <InfoIcon className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <p>
                                          Estimate for this lending pool after
                                          this repay: (collateral × pool
                                          minimum liquidation threshold) ÷ total
                                          borrows (after subtracting this amount
                                          in USD), same shape as on-chain health,
                                          capped at 3.00 like Portfolio. The
                                          colored change is percent vs your
                                          current pool position before this
                                          repay.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </span>
                              </div>
                              {!showPoolHealthEstimate && (
                                <InfoIcon className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5" />
                              )}
                              {expandedDetails.healthFactor ? (
                                <ChevronUp className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5" />
                              ) : (
                                <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5" />
                              )}
                            </button>
                            <div className="flex min-w-0 flex-col items-end gap-0.5 text-right shrink-0">
                              {repayPoolHealthLoading ? (
                                <span className="text-xs md:text-sm text-slate-400 dark:text-slate-500">
                                  …
                                </span>
                              ) : showPoolHealthEstimate ? (
                                <>
                                  <span
                                    className={cn(
                                      "text-xs md:text-sm font-medium tabular-nums",
                                      estimatedPoolHealthMeta.value != null &&
                                        estimatedPoolHealthMeta.value <
                                          DEPOSIT_ESTIMATED_HEALTH_CRITICAL_MAX
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-slate-800 dark:text-white"
                                    )}
                                  >
                                    {estimatedPoolHealthMeta.value == null
                                      ? "—"
                                      : estimatedPoolHealthMeta.value.toFixed(2)}
                                  </span>
                                  {estimatedPoolHealthMeta.deltaPercent !=
                                  null ? (
                                    <span
                                      className={cn(
                                        "text-[10px] md:text-xs font-medium tabular-nums",
                                        estimatedPoolHealthMeta.deltaPercent > 0
                                          ? "text-green-600 dark:text-green-400"
                                          : estimatedPoolHealthMeta.deltaPercent <
                                              0
                                            ? "text-red-600 dark:text-red-400"
                                            : "text-slate-500 dark:text-slate-400"
                                      )}
                                    >
                                      {estimatedPoolHealthMeta.deltaPercent > 0
                                        ? "+"
                                        : ""}
                                      {estimatedPoolHealthMeta.deltaPercent.toFixed(
                                        1
                                      )}
                                      %
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span
                                  className={`text-xs md:text-sm font-medium ${healthFactorLabel.color}`}
                                >
                                  {healthFactorLabel.label}
                                  {marketStats.healthFactor !== null && (
                                    <>
                                      {" "}
                                      ({marketStats.healthFactor.toFixed(2)})
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          {expandedDetails.healthFactor && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700 space-y-2">
                              {showPoolHealthEstimate ? (
                                <>
                                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Health factor = (collateral × liquidation
                                    threshold) ÷ borrowed
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Uses this pool&apos;s collateral and borrow
                                    totals (USD) and the minimum liquidation
                                    threshold across your collateral in this
                                    pool, matching the borrow modal. Values are
                                    capped at 3.00 for display.
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Portfolio aggregate health
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Shown when a pool-level estimate
                                    isn&apos;t available. Based on global user
                                    data (may differ from a single pool).
                                  </p>
                                </>
                              )}
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {healthFactorDisplayValue === null
                                  ? "Health factor data not available. Please refresh your position data."
                                  : healthFactorDisplayValue >= 3.0
                                    ? `✓ Safe: ${healthFactorDisplayValue.toFixed(
                                        2
                                      )} (excellent health)`
                                    : healthFactorDisplayValue >= 1.5
                                      ? `✓ Moderate: ${healthFactorDisplayValue.toFixed(
                                          2
                                        )} (good health)`
                                      : healthFactorDisplayValue >= 1.2
                                        ? `⚠ Caution: ${healthFactorDisplayValue.toFixed(
                                            2
                                          )} (monitor closely)`
                                        : healthFactorDisplayValue >= 1.0
                                          ? `⚠ Critical: ${healthFactorDisplayValue.toFixed(
                                              2
                                            )} (at liquidation threshold)`
                                          : `✗ Liquidatable: ${healthFactorDisplayValue.toFixed(
                                              2
                                            )} (can be liquidated)`}
                              </p>
                              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                <p>• Safe (≥3.0): Excellent health</p>
                                <p>• Moderate (≥1.5): Good health</p>
                                <p>• Caution (≥1.2): Monitor closely</p>
                                <p>
                                  • Critical (≥1.0): At liquidation threshold
                                </p>
                                <p>
                                  • Liquidatable (&lt;1.0): Can be liquidated
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Collateral Factor */}
                        {marketStats.collateralFactor !== undefined && (
                          <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                            <div className="flex justify-between items-center">
                              <button
                                onClick={() => toggleDetail("collateralFactor")}
                                className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                              >
                                <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                  Collateral Factor
                                </span>
                                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                {expandedDetails.collateralFactor ? (
                                  <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                )}
                              </button>
                              <span className="text-xs md:text-sm font-medium text-slate-800 dark:text-white">
                                {marketStats.collateralFactor.toFixed(0)}%
                              </span>
                            </div>
                            {expandedDetails.collateralFactor && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                  Maximum borrowing power from this collateral. This represents
                                  the percentage of the collateral value that can be used for borrowing.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* LTV */}
                        <div>
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => toggleDetail("ltv")}
                              className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                            >
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                LTV
                              </span>
                              <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              {expandedDetails.ltv ? (
                                <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                              )}
                            </button>
                            <span className="text-xs md:text-sm font-medium text-slate-800 dark:text-white">
                              {marketStats.currentLTV.toFixed(2)}%
                            </span>
                          </div>
                          {expandedDetails.ltv && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Loan-to-Value ratio of your position. This shows
                                what percentage of your collateral is being used
                                for borrowing.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RepayModal;
