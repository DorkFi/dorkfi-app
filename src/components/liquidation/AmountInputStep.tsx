import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, Info, Calculator, AlertTriangle } from "lucide-react";
import { LiquidationAccount } from "@/hooks/useLiquidationData";
import { UserAsset } from "@/hooks/useUserAssets";

interface AmountInputStepProps {
  account: LiquidationAccount;
  repayAmountUSD: string;
  onAmountChange: (amount: string) => void;
  selectedCollateral: string;
  selectedDebt: string;
  calculations: {
    collateralNeeded: number;
    liquidationBonus: number;
    newLTV: number;
    collateralPrice: number;
    debtPrice: number;
  } | null;
  // Real-time asset data from useUserAssets
  collateralAssets?: UserAsset[];
  borrowedAssets?: UserAsset[];
}

export default function AmountInputStep({
  account,
  repayAmountUSD,
  onAmountChange,
  selectedCollateral,
  selectedDebt,
  calculations,
  collateralAssets,
  borrowedAssets,
}: AmountInputStepProps) {
  // Use real-time asset data instead of stale account data
  const selectedCollateralAsset = collateralAssets?.find(
    (a) => a.symbol === selectedCollateral
  );
  const selectedDebtAsset = borrowedAssets?.find(
    (a) => a.symbol === selectedDebt
  );

  // Calculate max liquidatable amount based on collateral (limited by close factor)
  const maxLiquidatableAmount = selectedCollateralAsset
    ? selectedCollateralAsset.depositValueUSD * (selectedCollateralAsset.closeFactor || 0.5)
    : (account.collateralAssets.find((a) => a.symbol === selectedCollateral)?.valueUSD || 0) * 0.5; // Default 50% close factor

  // Calculate max repay for selected debt
  const maxRepayForSelectedDebt = selectedDebtAsset
    ? selectedDebtAsset.borrowValueUSD
    : account.borrowedAssets.find((a) => a.symbol === selectedDebt)?.valueUSD || 0;

  // Final max amount is the minimum of max liquidatable (with close factor) and debt borrow value
  const finalMaxAmount = Math.min(maxLiquidatableAmount, maxRepayForSelectedDebt);

  // Validation logic
  const currentAmount = parseFloat(repayAmountUSD) || 0;
  const isAmountValid = currentAmount > 0 && currentAmount <= finalMaxAmount;
  const isAmountExceeded = currentAmount > finalMaxAmount;
  const isAmountTooSmall = currentAmount <= 0 && repayAmountUSD !== "";

  // Handle amount change with validation
  const handleAmountChange = (value: string) => {
    // Allow empty string for clearing
    if (value === "") {
      onAmountChange("");
      return;
    }

    // Only allow positive numbers
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      return;
    }

    onAmountChange(value);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Enter Amount to Repay
        </h2>
        <p className="text-muted-foreground">
          Enter the amount of debt you'll repay in USD. The protocol will take
          collateral equal to the repay amount plus the liquidation bonus.
        </p>
      </div>

      <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-800 dark:text-white">
                Repayment Amount
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Specify how much debt to repay
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="repay-amount"
                    className="text-slate-600 dark:text-slate-300 font-medium"
                  >
                    Amount to Repay (USD)
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Max is the minimum of collateral value (limited by close factor) and debt borrow value.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Tooltip>
                  <TooltipTrigger className="text-sm text-muted-foreground">
                    Max: ${finalMaxAmount.toLocaleString()}
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Maximum repayable amount is the minimum of collateral value (limited by close factor) and debt borrow value.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="relative">
                <Input
                  id="repay-amount"
                  type="number"
                  placeholder="0.00"
                  value={repayAmountUSD}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className={`bg-white/80 dark:bg-slate-700 text-slate-800 dark:text-white h-12 text-lg pr-20 ${
                    isAmountExceeded || isAmountTooSmall
                      ? "border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400"
                      : "border-gray-200 dark:border-slate-600"
                  }`}
                  max={finalMaxAmount}
                  disabled={!selectedDebt}
                />
                <button
                  type="button"
                  onClick={() => onAmountChange(finalMaxAmount.toString())}
                  disabled={!selectedDebt || finalMaxAmount <= 0}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-semibold bg-ocean-teal text-white rounded-md hover:bg-ocean-teal/90 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                  MAX
                </button>
              </div>
              {selectedDebt && (
                <div className="text-sm text-muted-foreground mt-2">
                  Available debt: ${maxRepayForSelectedDebt.toLocaleString()}{" "}
                  {selectedDebt}
                </div>
              )}

              {/* Validation Error Messages */}
              {isAmountExceeded && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Amount exceeds maximum repayable amount of $
                    {finalMaxAmount.toLocaleString()}. Please enter a smaller
                    amount.
                  </AlertDescription>
                </Alert>
              )}

              {isAmountTooSmall && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Please enter a valid amount greater than $0.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Context Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    Collateral
                  </span>
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <div>
                    <strong>{selectedCollateral}</strong>
                  </div>
                  <div>Will be seized to cover debt</div>
                </div>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <span className="font-medium text-orange-800 dark:text-orange-200">
                    Debt
                  </span>
                </div>
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  <div>
                    <strong>{selectedDebt}</strong>
                  </div>
                  <div>Will be repaid</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculations Preview */}
      {calculations && (
        <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calculator className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl text-slate-800 dark:text-white">
                  Liquidation Preview
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Review the liquidation details before proceeding
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">
                    {selectedCollateral} Price:
                  </span>
                  <span className="text-slate-800 dark:text-white font-semibold">
                    ${calculations.collateralPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">
                    {selectedDebt} Price:
                  </span>
                  <span className="text-slate-800 dark:text-white font-semibold">
                    ${calculations.debtPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600 dark:text-slate-300">
                    Debt to Repay:
                  </span>
                  <span className="text-slate-800 dark:text-white font-semibold">
                    {(parseFloat(repayAmountUSD) / (calculations?.debtPrice || 1)).toFixed(6)} {selectedDebt}
                    <span className="text-sm text-muted-foreground ml-2">
                      (${parseFloat(repayAmountUSD).toLocaleString()})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600 dark:text-slate-300">
                    Liquidation Bonus (5%):
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    ${calculations.liquidationBonus.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600 dark:text-slate-300">
                    Total Collateral Value:
                  </span>
                  <span className="text-slate-800 dark:text-white font-semibold">
                    $
                    {(
                      parseFloat(repayAmountUSD) + calculations.liquidationBonus
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600 dark:text-slate-300">
                    Collateral Needed:
                  </span>
                  <span className="text-slate-800 dark:text-white font-semibold">
                    {calculations.collateralNeeded.toFixed(4)}{" "}
                    {selectedCollateral}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">
                    New LTV After Liquidation:
                  </span>
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">
                    {(calculations.newLTV * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
