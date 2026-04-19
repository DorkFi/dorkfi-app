import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocaleNumberInput } from "@/components/ui/LocaleNumberInput";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { formatRelativeTime } from "@/utils/timeUtils";
import { getTokenConfig, NetworkId } from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";
import { usdValueForHumanTokenAmount } from "@/utils/assetDecimals";

interface SupplyBorrowFormProps {
  mode: "deposit" | "borrow";
  asset: string;
  walletBalance: number;
  walletBalanceUSD: number;
  availableToSupplyOrBorrow: number;
  supplyAPY?: number;
  totalSupply?: number;
  maxTotalDeposits?: number;
  userGlobalData?: {
    totalCollateralValue: number;
    totalBorrowValue: number;
    lastUpdateTime: number;
  } | null;
  collateralFactor?: number;
  onAmountChange: (amount: string, fiatValue: number) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  onRefreshWalletBalance?: () => void;
  hideButton?: boolean;
  isLoadingMaxBorrow?: boolean;
  maxBorrowError?: string | null;
  network?: string; // Optional network parameter for cross-network operations
  walletBalanceLastUpdated?: number;
  /** When set, replaces the MAX control on the amount field (e.g. multi-route deposit picker). */
  amountFieldEndAdornment?: ReactNode;
  /** Deposit: suffix after the numeric wallet balance (e.g. route label `fALGO` vs `ALGO`). */
  walletBalanceDisplaySymbol?: string;
  /** Deposit: override the teal card title (defaults to “Wallet Balance”). */
  walletBalanceRowTitle?: string;
  /** Borrow: suffix for max line (e.g. `ALGO` vs `fALGO`) when route changes units. */
  maxBorrowableUnitSymbol?: string;
  /** Borrow: Folks mint ratio failed while ALGO receive route is selected. */
  borrowFolksRateUnavailable?: boolean;
}

const SupplyBorrowForm = ({
  mode,
  asset,
  walletBalance,
  walletBalanceUSD,
  availableToSupplyOrBorrow,
  supplyAPY = 0,
  totalSupply = 0,
  maxTotalDeposits = 0,
  userGlobalData,
  collateralFactor = 0,
  onAmountChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  onRefreshWalletBalance,
  hideButton = false,
  isLoadingMaxBorrow = false,
  maxBorrowError = null,
  network,
  walletBalanceLastUpdated,
  amountFieldEndAdornment,
  walletBalanceDisplaySymbol,
  walletBalanceRowTitle,
  maxBorrowableUnitSymbol,
  borrowFolksRateUnavailable = false,
}: SupplyBorrowFormProps) => {
  const [amount, setAmount] = useState<number | "">("");
  const [fiatValue, setFiatValue] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { currentNetwork } = useNetwork();
  // Use provided network or fallback to current network
  const networkToUse = (network || currentNetwork) as NetworkId;
  const { price: tokenPrice, isLoading: priceLoading } = useTokenPrice(
    asset,
    networkToUse
  );

  // Get token config for decimal precision
  const tokenConfigRaw = getTokenConfig(networkToUse, asset);
  // Handle case where tokenConfig might be an array (multiple markets)
  const tokenConfig = Array.isArray(tokenConfigRaw)
    ? tokenConfigRaw[0]
    : tokenConfigRaw;
  const decimals = tokenConfig?.decimals || 6;

  console.log(`SupplyBorrowForm ${asset} tokenConfig`, {
    networkToUse,
    tokenConfig,
    decimals,
  });

  // Input validation function (amount is number | "" from LocaleNumberInput)
  const validateAmount = (numValue: number | null): string | null => {
    if (numValue === null || typeof numValue !== "number" || numValue !== numValue || numValue < 0) {
      return null;
    }
    const value = numValue;

    // Check wallet balance for deposits
    if (mode === "deposit" && value > walletBalance) {
      return "Insufficient wallet balance";
    }

    // Check available liquidity for borrows
    if (mode === "borrow") {
      if (borrowFolksRateUnavailable && value > 0) {
        return "Folks rate unavailable for ALGO borrow; pick f-asset or retry.";
      }
      const buffer = 0.1;
      const maxBorrowable = availableToSupplyOrBorrow * (1 - buffer);
      const roundedMaxBorrowable = Number(maxBorrowable.toFixed(decimals));

      if (value > roundedMaxBorrowable) {
        return "Insufficient liquidity available";
      }
    }

    // Check market capacity for deposits
    if (mode === "deposit" && maxTotalDeposits > 0) {
      const projectedTotalSupply = totalSupply + value;
      if (projectedTotalSupply > maxTotalDeposits) {
        const maxDeposit = Math.max(0, maxTotalDeposits - totalSupply);
        return `Deposit would exceed market capacity. Maximum deposit: ${maxDeposit.toFixed(
          decimals
        )} ${asset}`;
      }

      const capacityThreshold = maxTotalDeposits * 0.95;
      if (projectedTotalSupply > capacityThreshold) {
        const remainingCapacity = maxTotalDeposits - totalSupply;
        console.warn(
          `Warning: This deposit will use ${((value / remainingCapacity) * 100).toFixed(1)}% of remaining market capacity`
        );
      }
    }

    // Check decimal precision (compare as string to avoid float issues)
    const valueStr = value.toString();
    const decimalPlaces = valueStr.split(".")[1]?.length || 0;
    if (decimalPlaces > decimals) {
      return `Maximum ${decimals} decimal places allowed`;
    }

    return null;
  };

  const numAmount = amount === "" ? null : amount;

  // Calculate USD value and projected earnings
  useEffect(() => {
    const error = validateAmount(numAmount);
    setValidationError(error);

    const nextFiat =
      numAmount !== null && numAmount > 0 && tokenPrice > 0
        ? usdValueForHumanTokenAmount(numAmount, tokenPrice)
        : 0;
    setFiatValue(nextFiat);
    onAmountChange(
      numAmount !== null ? numAmount.toString() : "",
      nextFiat
    );
  }, [
    amount,
    tokenPrice,
    onAmountChange,
    walletBalance,
    availableToSupplyOrBorrow,
    totalSupply,
    maxTotalDeposits,
    decimals,
    mode,
    asset,
    borrowFolksRateUnavailable,
  ]);

  // Calculate max borrowable amount based on market liquidity only
  const calculateMaxBorrowable = () => {
    // Add a 0.1% buffer to prevent precision edge cases
    const buffer = 0.1;
    return availableToSupplyOrBorrow * (1 - buffer);
  };

  // USD max borrow from collateral (for display when token max is 0 but user has capacity)
  const maxBorrowableUSD =
    mode === "borrow" &&
    userGlobalData &&
    typeof collateralFactor === "number"
      ? Math.max(
          0,
          userGlobalData.totalCollateralValue * (collateralFactor / 100) -
            userGlobalData.totalBorrowValue
        )
      : 0;
  const hasCapacityNoLiquidity =
    mode === "borrow" &&
    calculateMaxBorrowable() === 0 &&
    maxBorrowableUSD > 0;

  const handleMaxClick = () => {
    if (mode === "deposit") {
      let maxDepositable = walletBalance;

      if (
        maxTotalDeposits &&
        maxTotalDeposits > 0 &&
        totalSupply !== undefined
      ) {
        const remainingCapacity = Math.max(0, maxTotalDeposits - totalSupply);
        maxDepositable = Math.min(walletBalance, remainingCapacity);
      }

      setAmount(Number(maxDepositable.toFixed(decimals)));
    } else {
      const maxBorrowAmount = calculateMaxBorrowable();
      setAmount(Number(maxBorrowAmount.toFixed(decimals)));
    }
  };

  const handleQuickAmount = (percentage: number) => {
    if (mode === "deposit") {
      let maxDepositable = walletBalance;

      if (
        maxTotalDeposits &&
        maxTotalDeposits > 0 &&
        totalSupply !== undefined
      ) {
        const remainingCapacity = Math.max(0, maxTotalDeposits - totalSupply);
        maxDepositable = Math.min(walletBalance, remainingCapacity);
      }

      setAmount(Number((maxDepositable * percentage).toFixed(decimals)));
    } else {
      const maxBorrowAmount = calculateMaxBorrowable();
      setAmount(Number((maxBorrowAmount * percentage).toFixed(decimals)));
    }
  };

  const isValidAmount = numAmount !== null && numAmount > 0 && !validationError;

  return (
    <div className="space-y-3">
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
            value={amount}
            onChange={(v) => setAmount(v ?? "")}
            formatOptions={{ maximumFractionDigits: decimals }}
            showValidationMessage={true}
            className={`bg-white/70 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white text-lg h-12 ${
              amountFieldEndAdornment != null ? "pr-36" : "pr-16"
            } ${validationError ? "border-red-300 dark:border-red-600" : ""}`}
          />
          {amountFieldEndAdornment != null ? (
            <div className="absolute right-1 top-1/2 flex max-w-[calc(100%-3rem)] -translate-y-1/2 items-center justify-end">
              {amountFieldEndAdornment}
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleMaxClick}
              disabled={mode === "borrow" && isLoadingMaxBorrow}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-400 hover:bg-teal-400/10 h-8 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === "borrow" && isLoadingMaxBorrow ? "..." : "MAX"}
            </Button>
          )}
        </div>

        {/* Validation Error */}
        {validationError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {validationError}
          </p>
        )}

        {/* Quick Amount Buttons */}
        {((mode === "deposit" && walletBalance > 0) ||
          (mode === "borrow" && calculateMaxBorrowable() > 0)) && (
            <div className="flex gap-2">
              {[0.25, 0.5, 0.75, 1].map((percentage) => (
                <Button
                  key={percentage}
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickAmount(percentage)}
                  className={`flex-1 text-xs h-8 ${mode === "deposit"
                    ? "border-teal-200 text-teal-600 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-400 dark:hover:bg-teal-900/20"
                    : "border-whale-gold/30 text-whale-gold hover:bg-whale-gold/10 dark:border-whale-gold/50 dark:text-whale-gold dark:hover:bg-whale-gold/20"
                    }`}
                >
                  {percentage === 1 ? "100%" : `${percentage * 100}%`}
                </Button>
              ))}
            </div>
          )}

        {/* USD Value */}
        {fiatValue > 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ≈ $
            {fiatValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            {priceLoading && (
              <span className="ml-2 text-xs text-slate-400">
                (updating price...)
              </span>
            )}
          </p>
        )}

        {/* Projected Earnings for Deposits */}
        {/*mode === "deposit" && projectedEarnings > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-700 dark:text-green-300 font-medium">
              💰 Projected Annual Earnings
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              {projectedEarnings.toFixed(decimals)} {asset} (${(projectedEarnings * tokenPrice).toFixed(2)})
            </p>
            <p className="text-xs text-green-500 dark:text-green-500 mt-1">
              Based on {supplyAPY.toFixed(2)}% APY
            </p>
          </div>
        )*/}

        {/* Wallet Balance / Max Borrowable Display */}
        <div
          className={`p-3 rounded-lg border ${mode === "deposit"
            ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800"
            : "bg-whale-gold/10 border-whale-gold/30"
            }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${mode === "deposit" ? "bg-teal-500" : "bg-whale-gold"
                  }`}
              ></div>
              <span
                className={`text-sm font-medium ${mode === "deposit"
                  ? "text-teal-700 dark:text-teal-300"
                  : "text-whale-gold"
                  }`}
              >
                {mode === "deposit"
                  ? walletBalanceRowTitle ?? "Wallet Balance"
                  : "Max Borrowable"}
              </span>
              {mode === "deposit" && onRefreshWalletBalance && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRefreshWalletBalance}
                  className={`h-6 w-6 p-0 hover:bg-opacity-20 ${mode === "deposit"
                    ? "text-teal-600 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-800"
                    : "text-whale-gold hover:bg-whale-gold/20"
                    }`}
                  title="Refresh wallet balance"
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
              <div
                className={`text-sm font-semibold ${mode === "deposit"
                  ? "text-teal-800 dark:text-teal-200"
                  : "text-whale-gold"
                  }`}
              >
                {mode === "deposit"
                  ? `${walletBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })} ${walletBalanceDisplaySymbol ?? asset}`
                  : isLoadingMaxBorrow
                    ? "Calculating..."
                    : maxBorrowError
                      ? "Error"
                      : borrowFolksRateUnavailable
                        ? "—"
                        : `${calculateMaxBorrowable().toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })} ${maxBorrowableUnitSymbol ?? asset}`}
              </div>
              {mode === "borrow" && maxBorrowError && (
                <div className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {maxBorrowError}
                </div>
              )}
              {mode === "borrow" && borrowFolksRateUnavailable && !maxBorrowError && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Folks rate unavailable; choose f-asset borrow or retry.
                </div>
              )}
              <div
                className={`text-xs ${mode === "deposit"
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-whale-gold/80"
                  }`}
              >
                {mode === "deposit" ? (
                  <>
                    {`≈ $${walletBalanceUSD.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
                    {walletBalanceLastUpdated && (
                      <span className="ml-2 text-[11px] opacity-80">
                        · Updated {formatRelativeTime(walletBalanceLastUpdated)}
                      </span>
                    )}
                  </>
                ) : userGlobalData
                  ? hasCapacityNoLiquidity
                    ? `Your capacity ≈ $${maxBorrowableUSD.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} · no liquidity in this market`
                    : `≈ $${(
                        calculateMaxBorrowable() * (tokenPrice || 1)
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                  : "Connect wallet to see USD value"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Balance Display - Deposit Mode Centered */}
      {/* TODO add back}
      {/*mode === "deposit" && (
        <div className="flex flex-col items-center justify-center text-center gap-1 py-3 mt-2 mb-2 bg-white/60 dark:bg-slate-800/60 rounded-lg shadow-sm border border-gray-200/40 dark:border-slate-700/30 min-w-[210px]">
          <div className="text-base font-bold text-slate-800 dark:text-white">{asset}</div>
          <div className="text-sm text-teal-700 dark:text-teal-300 font-semibold">{walletBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens</div>
          {typeof userDepositBalance === 'number' && userDepositBalance > 0 && (
            <div className="text-xs text-slate-400 dark:text-teal-400 flex flex-row items-center justify-center gap-1">
              {userDepositBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} n{asset}
            </div>
          )}
          <div className="text-xs text-slate-500 dark:text-slate-400">${tokenPrice ? tokenPrice.toFixed(3) : '1.000'} per token</div>
        </div>
      )*/}

      {!hideButton && (
        <Button
          onClick={onSubmit}
          disabled={!isValidAmount || isLoading || disabled}
          className={`w-full font-semibold text-white h-12 transition-all hover:scale-105 ${mode === "deposit"
            ? "bg-teal-600 hover:bg-teal-700"
            : "bg-whale-gold hover:bg-whale-gold/90 text-black"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Processing...
            </div>
          ) : (
            `${mode === "deposit" ? "Supply" : "Borrow"} ${asset}`
          )}
        </Button>
      )}
    </div>
  );
};

export default SupplyBorrowForm;
