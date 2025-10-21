
import React, { useState, useEffect } from 'react';
import DorkFiButton from '@/components/ui/DorkFiButton';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { useUserAssets } from '@/hooks/useUserAssets';
import { LiquidationParams } from './EnhancedAccountDetailModal';
import LiquidationStepNavigation from './LiquidationStepNavigation';
import CollateralSelectionStep from './CollateralSelectionStep';
import DebtSelectionStep from './DebtSelectionStep';
import AmountInputStep from './AmountInputStep';

interface LiquidationStepOneProps {
  account: LiquidationAccount;
  onComplete: (params: LiquidationParams) => void;
  onCancel: () => void;
}

export default function LiquidationStepOne({ account, onComplete, onCancel }: LiquidationStepOneProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCollateral, setSelectedCollateral] = useState<string>('');
  const [selectedDebt, setSelectedDebt] = useState<string>('');
  const [repayAmountUSD, setRepayAmountUSD] = useState<string>('');
  const [calculations, setCalculations] = useState<{
    collateralNeeded: number;
    liquidationBonus: number;
    newLTV: number;
    collateralPrice: number;
    debtPrice: number;
  } | null>(null);

  const liquidationBonusRate = 0.05; // 5% bonus

  // Get real-time asset data
  const { assets } = useUserAssets(account.walletAddress);
  
  // Filter assets into collateral and borrowed categories
  const collateralAssets = assets.filter(asset => asset.depositBalance > 0);
  const borrowedAssets = assets.filter(asset => asset.borrowBalance > 0);

  // Calculate completed steps
  const completedSteps = [];
  if (selectedCollateral) completedSteps.push(1);
  if (selectedDebt) completedSteps.push(2);
  if (repayAmountUSD && parseFloat(repayAmountUSD) > 0) completedSteps.push(3);

  // Calculate disabled steps
  const disabledSteps = [];
  if (!selectedCollateral) disabledSteps.push(2, 3);
  if (!selectedDebt) disabledSteps.push(3);

  // Reset subsequent steps when earlier steps change
  useEffect(() => {
    if (currentStep === 1) {
      setSelectedDebt('');
      setRepayAmountUSD('');
      setCalculations(null);
    } else if (currentStep === 2) {
      setRepayAmountUSD('');
      setCalculations(null);
    }
  }, [currentStep]);

  // Reset debt selection when collateral changes
  useEffect(() => {
    if (selectedCollateral) {
      setSelectedDebt('');
      setRepayAmountUSD('');
      setCalculations(null);
    }
  }, [selectedCollateral]);

  // Reset repay amount when debt changes
  useEffect(() => {
    if (selectedDebt) {
      setRepayAmountUSD('');
      setCalculations(null);
    }
  }, [selectedDebt]);

  // Calculate liquidation details
  useEffect(() => {
    if (selectedCollateral && selectedDebt && repayAmountUSD && parseFloat(repayAmountUSD) > 0) {
      const repayAmount = parseFloat(repayAmountUSD);
      
      // Get real prices from market data
      const selectedCollateralAsset = collateralAssets?.find(a => a.symbol === selectedCollateral);
      const selectedDebtAsset = borrowedAssets?.find(a => a.symbol === selectedDebt);
      
      const collateralPrice = selectedCollateralAsset?.tokenPrice || 1;
      const debtPrice = selectedDebtAsset?.tokenPrice || 1;
      
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
        debtPrice,
      });
    } else {
      setCalculations(null);
    }
  }, [selectedCollateral, selectedDebt, repayAmountUSD, account.totalBorrowed, account.totalSupplied]);

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleContinue = () => {
    if (!selectedCollateral || !selectedDebt || !repayAmountUSD || !calculations) return;

    const params: LiquidationParams = {
      repayAmountUSD: parseFloat(repayAmountUSD),
      repayToken: selectedDebt,
      collateralToken: selectedCollateral,
      collateralAmount: calculations.collateralNeeded,
      liquidationBonus: calculations.liquidationBonus,
      debtPrice: calculations.debtPrice,
    };

    onComplete(params);
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return !!selectedCollateral;
      case 2:
        return !!selectedDebt;
      case 3:
        if (!repayAmountUSD || !calculations) return false;
        const amount = parseFloat(repayAmountUSD);
        if (amount <= 0) return false;
        
        // Check if amount exceeds maximum repayable using corrected close factor logic
        const selectedCollateralAsset = collateralAssets?.find(a => a.symbol === selectedCollateral);
        const selectedDebtAsset = borrowedAssets?.find(a => a.symbol === selectedDebt);
        
        // Calculate max liquidatable amount based on collateral (limited by close factor)
        const maxLiquidatableAmount = selectedCollateralAsset 
          ? selectedCollateralAsset.depositValueUSD * (selectedCollateralAsset.closeFactor || 0.5)
          : (account.collateralAssets.find(a => a.symbol === selectedCollateral)?.valueUSD || 0) * 0.5; // Default 50% close factor
        
        // Calculate max repay for selected debt
        const maxRepayForSelectedDebt = selectedDebtAsset 
          ? selectedDebtAsset.borrowValueUSD 
          : (account.borrowedAssets.find(a => a.symbol === selectedDebt)?.valueUSD || 0);
        
        // Final max amount is the minimum of max liquidatable (with close factor) and debt borrow value
        const finalMaxAmount = Math.min(maxLiquidatableAmount, maxRepayForSelectedDebt);
        
        return amount <= finalMaxAmount;
      default:
        return false;
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <CollateralSelectionStep
            account={account}
            selectedCollateral={selectedCollateral}
            onCollateralChange={setSelectedCollateral}
          />
        );
      case 2:
        return (
          <DebtSelectionStep
            account={account}
            selectedDebt={selectedDebt}
            onDebtChange={setSelectedDebt}
            selectedCollateral={selectedCollateral}
          />
        );
      case 3:
        return (
          <AmountInputStep
            account={account}
            repayAmountUSD={repayAmountUSD}
            onAmountChange={setRepayAmountUSD}
            selectedCollateral={selectedCollateral}
            selectedDebt={selectedDebt}
            calculations={calculations}
            collateralAssets={collateralAssets}
            borrowedAssets={borrowedAssets}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Navigation */}
      <LiquidationStepNavigation
        currentStep={currentStep}
        onStepChange={handleStepChange}
        completedSteps={completedSteps}
        disabledSteps={disabledSteps}
      />

      {/* Current Step Content */}
      <div className="min-h-[400px]">
        {renderCurrentStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-border">
        <div className="flex gap-3">
          <DorkFiButton
            variant="secondary"
            onClick={onCancel}
            className="min-h-[44px] min-w-[100px] font-semibold"
          >
            Cancel
          </DorkFiButton>
          {currentStep > 1 && (
            <DorkFiButton
              variant="secondary"
              onClick={handlePrevious}
              className="min-h-[44px] min-w-[120px] font-semibold flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </DorkFiButton>
          )}
        </div>

        <div className="flex gap-3">
          {currentStep < 3 ? (
            <DorkFiButton
              onClick={handleNext}
              disabled={!canProceedToNext()}
              className="min-h-[44px] min-w-[120px] font-semibold flex items-center gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </DorkFiButton>
          ) : (
            <DorkFiButton
              onClick={handleContinue}
              disabled={!canProceedToNext()}
              className="min-h-[44px] min-w-[180px] font-semibold"
            >
              Continue to Confirmation
            </DorkFiButton>
          )}
        </div>
      </div>
    </div>
  );
}
