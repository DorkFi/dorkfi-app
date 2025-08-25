
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ArrowLeft } from 'lucide-react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import LiquidationStepOne from './LiquidationStepOne';
import LiquidationStepTwo from './LiquidationStepTwo';
import LiquidationCongrats from './LiquidationCongrats';
import { useToast } from '@/hooks/use-toast';
import { shortenAddress } from '@/utils/liquidationUtils';
import { getRiskColor, getRiskLevel, getRiskVariant } from '@/utils/riskCalculations';
import AccountOverview from './AccountOverview';

export interface LiquidationParams {
  repayAmountUSD: number;
  repayToken: string;
  collateralToken: string;
  collateralAmount: number;
  liquidationBonus: number;
}

interface EnhancedAccountDetailModalProps {
  account: LiquidationAccount;
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
  initialStep?: 'overview' | 'step1';
}

export default function EnhancedAccountDetailModal({ 
  account, 
  isOpen, 
  onClose, 
  isMobile,
  initialStep = 'overview',
}: EnhancedAccountDetailModalProps) {
  const [liquidationStep, setLiquidationStep] = useState<'overview' | 'step1' | 'step2' | 'success'>('overview');
  const [liquidationParams, setLiquidationParams] = useState<LiquidationParams | null>(null);
  const { toast } = useToast();

  // Sync initial step when modal opens or account changes
  useEffect(() => {
    if (isOpen) {
      setLiquidationStep(initialStep);
      setLiquidationParams(null);
    }
  }, [isOpen, initialStep, account]);

  const handleInitiateLiquidation = () => {
    setLiquidationStep('step1');
  };

  const handleStepOneComplete = (params: LiquidationParams) => {
    setLiquidationParams(params);
    setLiquidationStep('step2');
  };

  const handleLiquidationConfirm = async () => {
    if (!liquidationParams) return;

    try {
      // Mock liquidation execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Show success screen instead of toast and closing
      setLiquidationStep('success');
    } catch (error) {
      toast({
        title: "Transaction Failed",
        description: "Please try again or adjust gas settings.",
        variant: "destructive",
      });
    }
  };

  const handleBackToOverview = () => {
    setLiquidationStep('overview');
    setLiquidationParams(null);
  };

  const handleBackToStepOne = () => {
    setLiquidationStep('step1');
  };

  const handleViewTransaction = () => {
    window.open("https://testnet.algoexplorer.io/", "_blank");
  };

  const handleReturnToMarkets = () => {
    // Reset and close
    setLiquidationStep('overview');
    setLiquidationParams(null);
    onClose();
  };

  const handleLiquidateAnother = () => {
    setLiquidationStep('overview');
    setLiquidationParams(null);
  };

  const renderContent = () => {
    switch (liquidationStep) {
      case 'step1':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-1 mb-3">
              <button type="button" className="p-2 hover:bg-muted rounded-lg transition-colors" onClick={handleBackToOverview}>
                <ArrowLeft className="h-4 w-4 text-foreground" />
              </button>
              <h3 className="text-base md:text-lg font-semibold text-foreground">Step 1: Select Collateral & Amount</h3>
            </div>
            <LiquidationStepOne 
              account={account} 
              onComplete={handleStepOneComplete}
              onCancel={handleBackToOverview}
            />
          </div>
        );
      case 'step2':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-1 mb-3">
              <button type="button" className="p-2 hover:bg-muted rounded-lg transition-colors" onClick={handleBackToStepOne}>
                <ArrowLeft className="h-4 w-4 text-foreground" />
              </button>
              <h3 className="text-base md:text-lg font-semibold text-foreground">Step 2: Confirm Liquidation</h3>
            </div>
            <LiquidationStepTwo 
              account={account}
              liquidationParams={liquidationParams!}
              onConfirm={handleLiquidationConfirm}
              onCancel={handleBackToStepOne}
            />
          </div>
        );
      case 'success':
        return (
          <LiquidationCongrats
            account={account}
            liquidationParams={liquidationParams!}
            onViewTransaction={handleViewTransaction}
            onReturnToMarkets={handleReturnToMarkets}
            onLiquidateAnother={handleLiquidateAnother}
            onClose={handleReturnToMarkets}
          />
        );
      default:
        return (
          <AccountOverview 
            account={account} 
            onInitiateLiquidation={handleInitiateLiquidation}
          />
        );
    }
  };

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="max-h-[90vh] bg-background border-border text-foreground rounded-t-xl">
          <DrawerHeader className="border-b border-border pb-2">
            <DrawerTitle className="text-foreground text-left">
              {liquidationStep === 'success' ? 'Liquidation Complete' : `Account Details - ${shortenAddress(account.walletAddress)}`}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 pt-4">
            {renderContent()}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-background border-border text-foreground rounded-xl border border-gray-200/50 dark:border-ocean-teal/20 shadow-xl card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all p-0">
        <DialogHeader className="border-b border-border p-4 pb-3">
          <DialogTitle className="text-foreground text-left">
            {liquidationStep === 'success' ? 'Liquidation Complete' : `Account Details - ${shortenAddress(account.walletAddress)}`}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto p-4 pt-3">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
