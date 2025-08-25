
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DorkFiButton from '@/components/ui/DorkFiButton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calculator, DollarSign, Info } from 'lucide-react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { LiquidationParams } from './EnhancedAccountDetailModal';

interface LiquidationStepOneProps {
  account: LiquidationAccount;
  onComplete: (params: LiquidationParams) => void;
  onCancel: () => void;
}

// Mock prices for demonstration
const MOCK_PRICES: Record<string, number> = {
  'ETH': 2000,
  'BTC': 45000,
  'USDC': 1,
  'VOI': 0.5,
  'ALGO': 0.25,
  'UNIT': 0.1,
};

export default function LiquidationStepOne({ account, onComplete, onCancel }: LiquidationStepOneProps) {
  const [selectedCollateral, setSelectedCollateral] = useState<string>('');
  const [repayAmountUSD, setRepayAmountUSD] = useState<string>('');
  const [calculations, setCalculations] = useState<{
    collateralNeeded: number;
    liquidationBonus: number;
    newLTV: number;
    collateralPrice: number;
  } | null>(null);

  const liquidationBonusRate = 0.05; // 5% bonus

  useEffect(() => {
    if (selectedCollateral && repayAmountUSD && parseFloat(repayAmountUSD) > 0) {
      const repayAmount = parseFloat(repayAmountUSD);
      const collateralPrice = MOCK_PRICES[selectedCollateral] || 1;
      const liquidationBonus = repayAmount * liquidationBonusRate;
      const totalCollateralValue = repayAmount + liquidationBonus;
      const collateralNeeded = totalCollateralValue / collateralPrice;
      
      // Calculate new LTV after liquidation
      const newTotalBorrowed = account.totalBorrowed - repayAmount;
      const newLTV = newTotalBorrowed > 0 ? newTotalBorrowed / account.totalSupplied : 0;

      setCalculations({
        collateralNeeded,
        liquidationBonus,
        newLTV,
        collateralPrice,
      });
    } else {
      setCalculations(null);
    }
  }, [selectedCollateral, repayAmountUSD, account.totalBorrowed, account.totalSupplied]);

  const handleContinue = () => {
    if (!selectedCollateral || !repayAmountUSD || !calculations) return;

    const params: LiquidationParams = {
      repayAmountUSD: parseFloat(repayAmountUSD),
      repayToken: account.borrowedAssets[0]?.symbol || 'USDC', // Assuming first borrowed asset
      collateralToken: selectedCollateral,
      collateralAmount: calculations.collateralNeeded,
      liquidationBonus: calculations.liquidationBonus,
    };

    onComplete(params);
  };

  const maxRepayAmount = Math.min(
    account.totalBorrowed * 0.5, // Max 50% of debt
    selectedCollateral ? (account.collateralAssets.find(a => a.symbol === selectedCollateral)?.valueUSD || 0) : 0
  );

  return (
    <div className="space-y-4">
      {/* Collateral Selection */}
      <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base md:text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Select Collateral Asset
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top">
                Choose which collateral will be seized to cover the debt. You'll receive a liquidation bonus.
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <Label htmlFor="collateral-select" className="text-slate-600 dark:text-slate-300">
                Available Collateral Assets
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  Only assets with sufficient value are shown.
                </TooltipContent>
              </Tooltip>
            </div>
            <Select value={selectedCollateral} onValueChange={setSelectedCollateral}>
              <SelectTrigger className="bg-background border border-border text-foreground">
                <SelectValue placeholder="Choose collateral asset" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border border-border z-50">
                {account.collateralAssets.map((asset) => (
                  <SelectItem key={asset.symbol} value={asset.symbol} className="text-slate-800 dark:text-white">
                    {asset.symbol} - {asset.amount.toLocaleString()} (${asset.valueUSD.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Repayment Amount */}
      <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base md:text-lg text-slate-800 dark:text-white flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Debt Repayment Amount
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top">
                Enter the amount of debt you'll repay in USD. The protocol will take collateral equal to the repay amount plus the liquidation bonus.
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="repay-amount" className="text-slate-600 dark:text-slate-300">
                  Amount to Repay (USD)
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Max is the lesser of 50% of current debt or the selected collateral's value.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Tooltip>
                <TooltipTrigger className="text-xs text-muted-foreground">
                  Max repayable: ${maxRepayAmount.toLocaleString()}
                </TooltipTrigger>
                <TooltipContent side="top">
                  Calculated as min(50% of total debt, selected collateral value).
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="repay-amount"
              type="number"
              placeholder="0.00"
              value={repayAmountUSD}
              onChange={(e) => setRepayAmountUSD(e.target.value)}
              className="bg-white/80 dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-slate-800 dark:text-white"
              max={maxRepayAmount}
            />
          </div>
        </CardContent>
      </Card>

      {/* Calculations */}
      {calculations && (
        <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base md:text-lg text-whale-gold">Liquidation Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">Collateral Price:</span>
              <span className="text-slate-800 dark:text-white font-semibold">
                ${calculations.collateralPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">Liquidation Bonus (5%):</span>
              <span className="text-ocean-teal font-semibold">
                ${calculations.liquidationBonus.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">Collateral Needed:</span>
              <span className="text-slate-800 dark:text-white font-semibold">
                {calculations.collateralNeeded.toFixed(4)} {selectedCollateral}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">New LTV After Liquidation:</span>
              <span className="text-whale-gold font-semibold">
                {(calculations.newLTV * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <DorkFiButton
          variant="secondary"
          onClick={onCancel}
          className="min-h-[40px] min-w-[92px] font-semibold text-sm"
        >
          Cancel
        </DorkFiButton>
        <DorkFiButton
          onClick={handleContinue}
          disabled={!selectedCollateral || !repayAmountUSD || !calculations}
          className="min-h-[40px] min-w-[140px] font-semibold text-sm"
        >
          Continue to Confirmation
        </DorkFiButton>
      </div>
    </div>
  );
}
