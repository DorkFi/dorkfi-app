import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { getTokenConfig } from "@/config";
import { useNetwork } from "@/contexts/NetworkContext";

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
}: SupplyBorrowFormProps) => {
  const [amount, setAmount] = useState("");
  const [fiatValue, setFiatValue] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { currentNetwork } = useNetwork();
  const { price: tokenPrice, isLoading: priceLoading } = useTokenPrice(asset);

  // Get token config for decimal precision
  const tokenConfig = getTokenConfig(currentNetwork, asset);
  const decimals = tokenConfig?.decimals || 6;

  // Input validation function
  const validateAmount = (value: string): string | null => {
    if (!value) return null;

    const numValue = parseFloat(value);

    // Check if it's a valid number
    if (isNaN(numValue) || numValue < 0) {
      return "Please enter a valid amount";
    }

    // Check wallet balance for deposits
    if (mode === "deposit" && numValue > walletBalance) {
      return "Insufficient wallet balance";
    }

    // Check available liquidity for borrows
    if (mode === "borrow") {
      // Round and apply buffer to availableToSupplyOrBorrow to avoid precision issues
      const buffer = 0.1;
      const maxBorrowable = availableToSupplyOrBorrow * (1 - buffer);
      const roundedMaxBorrowable = Number(maxBorrowable.toFixed(decimals));

      if (numValue > roundedMaxBorrowable) {
        console.log({
          availableToSupplyOrBorrow,
          maxBorrowable,
          roundedMaxBorrowable,
          numValue,
          decimals,
        });
        return "Insufficient liquidity available";
      }
    }

    // Check market capacity for deposits
    if (mode === "deposit" && maxTotalDeposits > 0) {
      const projectedTotalSupply = totalSupply + numValue;
      if (projectedTotalSupply > maxTotalDeposits) {
        const maxDeposit = Math.max(0, maxTotalDeposits - totalSupply);
        return `Deposit would exceed market capacity. Maximum deposit: ${maxDeposit.toFixed(
          decimals
        )} ${asset}`;
      }

      // Warning when approaching capacity (within 5% of limit)
      const capacityThreshold = maxTotalDeposits * 0.95;
      if (projectedTotalSupply > capacityThreshold) {
        const remainingCapacity = maxTotalDeposits - totalSupply;
        const warningMessage = `Warning: This deposit will use ${(
          (numValue / remainingCapacity) *
          100
        ).toFixed(1)}% of remaining market capacity`;
        // Don't block the transaction, just show warning
        console.warn(warningMessage);
      }
    }

    // Check decimal precision
    const decimalPlaces = value.split(".")[1]?.length || 0;
    if (decimalPlaces > decimals) {
      return `Maximum ${decimals} decimal places allowed`;
    }

    return null;
  };

  // Calculate USD value and projected earnings
  useEffect(() => {
    const error = validateAmount(amount);
    setValidationError(error);

    if (amount && tokenPrice > 0) {
      const numAmount =
        parseFloat(amount) * (Math.pow(10, decimals) / Math.pow(10, 6));
      setFiatValue(numAmount * tokenPrice);
    } else {
      setFiatValue(0);
    }
    onAmountChange(amount, fiatValue);
  }, [
    amount,
    tokenPrice,
    fiatValue,
    onAmountChange,
    walletBalance,
    availableToSupplyOrBorrow,
    decimals,
    mode,
  ]);

  // Calculate max borrowable amount based on market liquidity only
  const calculateMaxBorrowable = () => {
    // Add a 0.1% buffer to prevent precision edge cases
    const buffer = 0.1;
    return availableToSupplyOrBorrow * (1 - buffer);
  };

  const handleMaxClick = () => {
    if (mode === "deposit") {
      // Use minimum of wallet balance and maximum depositable amount
      let maxDepositable = walletBalance;

      if (
        maxTotalDeposits &&
        maxTotalDeposits > 0 &&
        totalSupply !== undefined
      ) {
        const remainingCapacity = Math.max(0, maxTotalDeposits - totalSupply);
        maxDepositable = Math.min(walletBalance, remainingCapacity);

        // TODO adjust when network token and borrow mode accordingly
      }

      setAmount(maxDepositable.toFixed(decimals));
    } else {
      // For borrow mode, use the calculated max borrowable amount
      const maxBorrowAmount = calculateMaxBorrowable(); // Use actual value
      setAmount(maxBorrowAmount.toFixed(decimals));
    }
  };

  const handleQuickAmount = (percentage: number) => {
    if (mode === "deposit") {
      // Use 100% of wallet balance for all tokens
      let maxDepositable = walletBalance;

      if (
        maxTotalDeposits &&
        maxTotalDeposits > 0 &&
        totalSupply !== undefined
      ) {
        const remainingCapacity = Math.max(0, maxTotalDeposits - totalSupply);
        maxDepositable = Math.min(walletBalance, remainingCapacity);

        // TODO adjust by min balance + buffer if network token (gas)
        // Scale down by 5% to handle edge cases and rounding errors
        //maxDepositable = maxDepositable
      }

      const quickAmount = (maxDepositable * percentage).toFixed(decimals);
      setAmount(quickAmount);
    } else {
      // For borrow mode, use the calculated max borrowable amount
      const maxBorrowAmount = calculateMaxBorrowable(); // Use actual value
      const quickAmount = (maxBorrowAmount * percentage).toFixed(decimals);
      setAmount(quickAmount);
    }
  };

  const isValidAmount = amount && parseFloat(amount) > 0 && !validationError;

  // Calculate projected earnings for deposits
  const projectedEarnings =
    mode === "deposit" && amount && supplyAPY > 0
      ? (parseFloat(amount) * supplyAPY) / 100
      : 0;

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
          <Input
            id="amount"
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`bg-white/70 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white pr-16 text-lg h-12 ${
              validationError ? "border-red-300 dark:border-red-600" : ""
            }`}
            step={1 / Math.pow(10, decimals)}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleMaxClick}
            disabled={mode === "borrow" && isLoadingMaxBorrow}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-400 hover:bg-teal-400/10 h-8 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mode === "borrow" && isLoadingMaxBorrow ? "..." : "MAX"}
          </Button>
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
                className={`flex-1 text-xs h-8 ${
                  mode === "deposit"
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
          className={`p-3 rounded-lg border ${
            mode === "deposit"
              ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800"
              : "bg-whale-gold/10 border-whale-gold/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  mode === "deposit" ? "bg-teal-500" : "bg-whale-gold"
                }`}
              ></div>
              <span
                className={`text-sm font-medium ${
                  mode === "deposit"
                    ? "text-teal-700 dark:text-teal-300"
                    : "text-whale-gold"
                }`}
              >
                {mode === "deposit" ? "Wallet Balance" : "Max Borrowable"}
              </span>
              {mode === "deposit" && onRefreshWalletBalance && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRefreshWalletBalance}
                  className={`h-6 w-6 p-0 hover:bg-opacity-20 ${
                    mode === "deposit"
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
                className={`text-sm font-semibold ${
                  mode === "deposit"
                    ? "text-teal-800 dark:text-teal-200"
                    : "text-whale-gold"
                }`}
              >
                {mode === "deposit"
                  ? `${walletBalance.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })} ${asset}`
                  : isLoadingMaxBorrow
                  ? "Calculating..."
                  : maxBorrowError
                  ? "Error"
                  : `${calculateMaxBorrowable().toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })} ${asset}`}
              </div>
              {mode === "borrow" && maxBorrowError && (
                <div className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {maxBorrowError}
                </div>
              )}
              <div
                className={`text-xs ${
                  mode === "deposit"
                    ? "text-teal-600 dark:text-teal-400"
                    : "text-whale-gold/80"
                }`}
              >
                {mode === "deposit"
                  ? `≈ $${walletBalanceUSD.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : userGlobalData
                  ? `≈ $${(
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
          className={`w-full font-semibold text-white h-12 transition-all hover:scale-105 ${
            mode === "deposit"
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
            `${mode === "deposit" ? "Deposit" : "Borrow"} ${asset}`
          )}
        </Button>
      )}
    </div>
  );
};

export default SupplyBorrowForm;
