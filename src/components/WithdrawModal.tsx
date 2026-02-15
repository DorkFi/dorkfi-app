import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocaleNumberInput } from "@/components/ui/LocaleNumberInput";
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon, ChevronDown, ChevronUp } from "lucide-react";
import { formatRelativeTime, formatRelativeTimeFromISO } from "@/utils/timeUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SupplyBorrowCongrats from "./SupplyBorrowCongrats";
import { calculateDepositAPY } from "@/utils/apyCalculations";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenIcon: string;
  currentlyDeposited: number;
  marketStats: {
    supplyAPY: number;
    borrowAPY: number;
    utilization: number;
    collateralFactor: number;
    tokenPrice: number;
    totalDeposits?: number;
    totalBorrows?: number;
    apyParameters?: { borrowRateBps: number; slopeBps: number; reserveFactorBps: number };
    marketCapacity?: number;
    liquidationMargin?: number;
    healthFactor?: number;
    ltv?: number;
    accruedInterest?: number;
    currentDepositIndex?: string;
    userDepositIndex?: string;
    scaledDeposits?: string;
    lastUpdateTime?: number | string;
  };
  /** Health-factor-safe max withdraw (from getMaxWithdrawable). When set, Max button and validation use this instead of full deposit. */
  maxWithdrawUnderlying?: number;
  onSubmit?: (amount: string, options?: { isMaxWithdraw?: boolean }) => void;
  isLoading?: boolean;
  showTooltip?: boolean;
  tooltipText?: string;
  onRefreshBalance?: () => void;
}

const WithdrawModal = ({
  isOpen,
  onClose,
  tokenSymbol,
  tokenIcon,
  currentlyDeposited,
  marketStats,
  maxWithdrawUnderlying,
  onSubmit,
  isLoading = false,
  showTooltip = false,
  tooltipText = "",
  onRefreshBalance,
}: WithdrawModalProps) => {
  const [amount, setAmount] = useState<number | "">("");
  const [fiatValue, setFiatValue] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const maxWithdrawRef = useRef(false);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const [showDebugValues, setShowDebugValues] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);

  // Calculate values using indices
  // Formula:
  // Current Deposit Value = (scaledDeposits × currentDepositIndex) ÷ SCALE
  // Original Deposit Amount = (scaledDeposits × userDepositIndex) ÷ SCALE
  // 
  // Since currentlyDeposited is already calculated correctly using currentDepositIndex,
  // we can calculate original deposit using the ratio of indices:
  // Original Deposit = currentlyDeposited × (userDepositIndex / currentDepositIndex)
  const calculateOriginalDeposit = (): number => {
    if (marketStats.currentDepositIndex && marketStats.userDepositIndex && currentlyDeposited > 0) {
      try {
        const currentIndex = Number(marketStats.currentDepositIndex);
        const userIndex = Number(marketStats.userDepositIndex);
        if (currentIndex > 0 && userIndex > 0) {
          // Validate: currentDepositIndex should always be >= userDepositIndex
          // (current index increases over time as interest accrues)
          if (userIndex > currentIndex) {
            console.warn(
              "Invalid index relationship: userDepositIndex > currentDepositIndex",
              {
                userDepositIndex: userIndex,
                currentDepositIndex: currentIndex,
                tokenSymbol,
              }
            );
            // If indices are invalid, fall back to using currentDeposited as original
            // (assume no interest accrued if indices are wrong)
            return currentlyDeposited;
          }
          // Original Deposit = currentlyDeposited × (userDepositIndex / currentDepositIndex)
          return currentlyDeposited * (userIndex / currentIndex);
        }
      } catch (error) {
        console.error("Error calculating original deposit:", error);
      }
    }
    // Fallback: calculate from currentlyDeposited and accruedInterest
    return currentlyDeposited - (marketStats.accruedInterest ?? 0);
  };

  // Use currentlyDeposited as the current deposit value (it's already calculated correctly)
  const currentDepositValue = currentlyDeposited;
  // Health-factor-safe max: when provided, cap by deposit so we never show more than user has
  const effectiveMaxWithdraw =
    maxWithdrawUnderlying != null
      ? Math.min(maxWithdrawUnderlying, currentDepositValue)
      : currentDepositValue;
  const originalDepositAmount = calculateOriginalDeposit();
  // Calculate accrued interest from the difference
  // Ensure accrued interest is never negative (shouldn't happen if indices are correct)
  const accruedInterest = Math.max(0, currentDepositValue - originalDepositAmount);

  // Debug logging for index validation
  if (marketStats.currentDepositIndex && marketStats.userDepositIndex) {
    const currentIndex = Number(marketStats.currentDepositIndex);
    const userIndex = Number(marketStats.userDepositIndex);
    if (userIndex > currentIndex) {
      console.error("WithdrawModal: Invalid index relationship detected", {
        tokenSymbol,
        currentDepositIndex: currentIndex,
        userDepositIndex: userIndex,
        currentlyDeposited,
        calculatedOriginalDeposit: originalDepositAmount,
        calculatedAccruedInterest: currentDepositValue - originalDepositAmount,
      });
    }
  }

  const handleToggleDetail = (field: string) => {
    setExpandedDetail(prev => (prev === field ? null : field));
  };

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setAmount("");
      setFiatValue(0);
      setInternalLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (amount !== "" && typeof amount === "number") {
      setFiatValue(amount * marketStats.tokenPrice);
    } else {
      setFiatValue(0);
    }
  }, [amount, marketStats.tokenPrice]);

  const handleMaxClick = () => {
    // Use health-factor-safe max when available (getMaxWithdrawable), else full deposit
    maxWithdrawRef.current = true;
    const formattedAmount = parseFloat(effectiveMaxWithdraw.toFixed(3));
    setAmount(formattedAmount);
  };

  const handleSubmit = async () => {
    setInternalLoading(true);
    try {
      if (onSubmit) {
        const isMaxWithdraw = maxWithdrawRef.current;
        maxWithdrawRef.current = false;
        await onSubmit(
          amount !== "" && typeof amount === "number" ? String(amount) : "",
          { isMaxWithdraw }
        );
      } else {
        console.log(`Withdraw ${amount !== "" ? amount.toString() : ""} ${tokenSymbol}`);

        await new Promise((resolve) => setTimeout(resolve, 500));
        setShowSuccess(true);
      }
    } catch (error) {
      console.error("Withdraw failed:", error);
      // Don't show success on error
    } finally {
      setInternalLoading(false);
    }
  };

  const handleViewTransaction = () => {
    window.open("https://testnet.algoexplorer.io/", "_blank");
  };

  const handleGoToPortfolio = () => {
    onClose();
    window.location.href = "/";
  };

  const handleMakeAnother = () => {
    setShowSuccess(false);
    setAmount("");
    setFiatValue(0);
  };

  // Use same precision (3 decimals) for comparison to avoid floating point failures
  const amountRounded =
    typeof amount === "number" && Number.isFinite(amount)
      ? Math.floor(amount * 1e3) / 1e3
      : NaN;
  const maxRounded =
    Number.isFinite(effectiveMaxWithdraw)
      ? Math.floor(effectiveMaxWithdraw * 1e3) / 1e3
      : 0;
  const isValidAmount =
    amount !== "" &&
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amountRounded > 0 &&
    amountRounded <= maxRounded;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-white rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all max-w-[95vw] md:max-w-md h-[90vh] md:h-auto max-h-[90vh] md:max-h-[85vh] overflow-hidden flex flex-col p-0">
        {showSuccess ? (
          <div className="p-6 overflow-y-auto">
            <SupplyBorrowCongrats
              transactionType="withdraw"
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
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 px-6 pt-4 pb-2 shrink-0">
              <DialogHeader className="pb-0">
                <DialogTitle className="text-2xl font-bold text-center text-slate-800 dark:text-white">
                  Withdraw
                </DialogTitle>
                <div className="flex items-center justify-center gap-3 pb-2 mt-3">
                  <img
                    src={tokenIcon}
                    alt={tokenSymbol}
                    className="w-12 h-12 rounded-full shadow"
                  />
                  {showTooltip ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xl font-semibold text-slate-800 dark:text-white cursor-help underline decoration-dotted">
                          {tokenSymbol}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tooltipText}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xl font-semibold text-slate-800 dark:text-white">
                      {tokenSymbol}
                    </span>
                  )}
                </div>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-4 md:pb-3 space-y-3 touch-pan-y min-h-0">
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
                    onChange={(v) => setAmount(v ?? "")}
                    formatOptions={{ maximumFractionDigits: 3 }}
                    className="bg-white/80 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white pr-16 text-lg h-12"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleMaxClick}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:bg-red-400/10 h-8 px-3"
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
                {maxWithdrawUnderlying != null &&
                  maxWithdrawUnderlying < currentDepositValue && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      You can withdraw up to{" "}
                      {effectiveMaxWithdraw.toLocaleString(undefined, {
                        maximumFractionDigits: 3,
                      })}{" "}
                      {tokenSymbol} (limited by collateral health).
                    </p>
                  )}
                {/* Deposited Balance Display */}
                <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        Deposited Balance
                      </span>
                      {onRefreshBalance && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={onRefreshBalance}
                          className="h-6 w-6 p-0 text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-800"
                          title="Refresh deposited balance"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </Button>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-red-800 dark:text-red-200">
                        {currentDepositValue.toLocaleString()} {tokenSymbol}
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-400">
                        ≈ ${(currentDepositValue * marketStats.tokenPrice).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="bg-white/80 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
                <CardContent className="p-3 space-y-2">
                  {/* Utilization */}
                  <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleToggleDetail("utilization")}
                        type="button"
                        className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                      >
                        <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Utilization</span>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        {expandedDetail === "utilization" ? (
                          <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                      <span className="text-sm font-medium text-slate-800 dark:text-white">
                        {marketStats.utilization.toFixed(2)}%
                      </span>
                    </div>
                    {expandedDetail === "utilization" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400">Percentage of supplied assets being borrowed.</p>
                      </div>
                    )}
                  </div>

                  {/* Collateral Factor */}
                  <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleToggleDetail("collateralFactor")}
                        type="button"
                        className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                      >
                        <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Collateral Factor</span>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        {expandedDetail === "collateralFactor" ? (
                          <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                      <span className="text-sm font-medium text-slate-800 dark:text-white">
                        {marketStats.collateralFactor.toFixed(0)}%
                      </span>
                    </div>
                    {expandedDetail === "collateralFactor" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400">Maximum borrowing power from this collateral.</p>
                      </div>
                    )}
                  </div>

                  {/* Estimated APY (adjusted after withdraw when amount entered) */}
                  <div className="border-b border-gray-200 dark:border-slate-700 pb-2 md:pb-3">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleToggleDetail("depositAPY")}
                        type="button"
                        className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                      >
                        <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Estimated APY</span>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        {expandedDetail === "depositAPY" ? (
                          <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                      {(() => {
                        const withdrawAmount = typeof amount === "number" && amount > 0 ? amount : 0;
                        const params = marketStats.apyParameters;
                        const totalSupply = marketStats.totalDeposits ?? 0;
                        const totalBorrow = marketStats.totalBorrows ?? 0;
                        if (withdrawAmount > 0 && params && totalSupply > 0) {
                          const newTotalSupply = Math.max(0, totalSupply - withdrawAmount);
                          const result = calculateDepositAPY(
                            { borrowRate: params.borrowRateBps, slope: params.slopeBps, reserveFactor: params.reserveFactorBps },
                            { totalScaledDeposits: newTotalSupply, totalScaledBorrows: totalBorrow, lastUpdateTime: Date.now() }
                          );
                          const currentAPY = marketStats.supplyAPY;
                          const changePercent = currentAPY > 0 ? ((result.apy - currentAPY) / currentAPY) * 100 : 0;
                          return (
                            <div className="text-right">
                              <div className="text-sm font-medium text-teal-600 dark:text-teal-400">
                                {Math.max(0, result.apy).toFixed(2)}%
                              </div>
                              {Math.abs(changePercent) > 0.1 && (
                                <div className={`text-xs flex items-center justify-end gap-1 ${
                                  changePercent > 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                                }`}>
                                  <span>{changePercent > 0 ? "↑" : "↓"}</span>
                                  <span>{changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return (
                          <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
                            {marketStats.supplyAPY.toFixed(2)}%
                          </span>
                        );
                      })()}
                    </div>
                    {expandedDetail === "depositAPY" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {typeof amount === "number" && amount > 0
                            ? "Deposit APY after your withdrawal (based on adjusted utilization)."
                            : `Annual percentage yield for supplying ${tokenSymbol}.`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Accrued Interest */}
                  <div className="pb-2 md:pb-3">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => handleToggleDetail("accruedInterest")}
                        type="button"
                        className="flex items-center gap-1.5 md:gap-2 hover:opacity-70 transition-opacity"
                      >
                        <span className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400">Accrued Interest</span>
                        <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        {expandedDetail === "accruedInterest" ? (
                          <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                      <span className={`text-sm font-medium ${accruedInterest > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-800 dark:text-white"
                        }`}>
                        {accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {tokenSymbol}
                      </span>
                    </div>
                    {expandedDetail === "accruedInterest" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                          {accruedInterest > 0
                            ? `Interest earned on your supplied ${tokenSymbol} since deposit.`
                            : `Interest calculation for your supplied ${tokenSymbol} since deposit.`
                          }
                        </p>
                        <div className="text-xs text-slate-500 dark:text-slate-500 space-y-1">
                          <p className="font-semibold">How it's calculated:</p>
                          <p>Accrued Interest = Current Deposit Value - Original Deposit Amount</p>
                          <p className="mt-1">• Current Deposit Value = (scaledDeposits × currentDepositIndex) ÷ SCALE</p>
                          <p>• Original Deposit Amount = (scaledDeposits × userDepositIndex) ÷ SCALE</p>
                          <p className="mt-1 text-slate-400 dark:text-slate-600">The deposit index increases over time as interest accrues, reflecting the growth of your deposit value.</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                          <button
                            onClick={() => setShowDebugValues(!showDebugValues)}
                            type="button"
                            className="flex items-center gap-1.5 hover:opacity-70 transition-opacity w-full"
                          >
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Debug Values</span>
                            <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            {showDebugValues ? (
                              <ChevronUp className="h-3 w-3 text-slate-400 dark:text-slate-500 ml-auto" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-slate-400 dark:text-slate-500 ml-auto" />
                            )}
                          </button>
                          {showDebugValues && (
                            <div className="mt-2 space-y-1 text-xs font-mono text-slate-500 dark:text-slate-500">
                              <div className="flex justify-between">
                                <span>Currently Deposited:</span>
                                <span className="text-slate-700 dark:text-slate-300">{currentDepositValue.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenSymbol}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Accrued Interest:</span>
                                <span className={`${accruedInterest > 0
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-slate-700 dark:text-slate-300"
                                  }`}>
                                  {accruedInterest.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenSymbol}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Original Deposit:</span>
                                <span className="text-slate-700 dark:text-slate-300">{originalDepositAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenSymbol}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Interest Rate (APY):</span>
                                <span className="text-slate-700 dark:text-slate-300">{marketStats.supplyAPY.toFixed(2)}%</span>
                              </div>
                              {marketStats.scaledDeposits && (
                                <div className="flex justify-between">
                                  <span>Scaled Deposits:</span>
                                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">{marketStats.scaledDeposits}</span>
                                </div>
                              )}
                              {marketStats.currentDepositIndex && (
                                <div className="flex justify-between">
                                  <span>Current Deposit Index:</span>
                                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">{marketStats.currentDepositIndex}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>User Deposit Index:</span>
                                <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                                  {marketStats.userDepositIndex || "N/A"}
                                </span>
                              </div>
                              {marketStats.currentDepositIndex && marketStats.userDepositIndex && (
                                <div className="flex justify-between">
                                  <span>Index Growth:</span>
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {((Number(marketStats.currentDepositIndex) / Number(marketStats.userDepositIndex) - 1) * 100).toFixed(4)}%
                                  </span>
                                </div>
                              )}
                              {marketStats.lastUpdateTime && (
                                <div className="flex justify-between">
                                  <span>Last Update Time:</span>
                                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                                    {typeof marketStats.lastUpdateTime === 'number'
                                      ? formatRelativeTime(marketStats.lastUpdateTime)
                                      : typeof marketStats.lastUpdateTime === 'string'
                                        ? formatRelativeTimeFromISO(marketStats.lastUpdateTime)
                                        : marketStats.lastUpdateTime
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-3 flex gap-3 shrink-0">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading || internalLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValidAmount || isLoading || internalLoading}
                className="flex-1 font-semibold h-11 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading || internalLoading ? (
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </div>
                ) : (
                  <span>Withdraw {tokenSymbol}</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawModal;
