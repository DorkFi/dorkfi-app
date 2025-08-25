
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DorkFiButton from '@/components/ui/DorkFiButton';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { LiquidationParams } from './EnhancedAccountDetailModal';
import { shortenAddress } from '@/utils/liquidationUtils';

interface LiquidationStepTwoProps {
  account: LiquidationAccount;
  liquidationParams: LiquidationParams;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function LiquidationStepTwo({ 
  account, 
  liquidationParams, 
  onConfirm, 
  onCancel 
}: LiquidationStepTwoProps) {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      await onConfirm();
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Transaction Summary */}
      <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800 dark:text-white flex items-center gap-2 text-base">
            <CheckCircle className="h-4 w-4 text-ocean-teal" />
            Liquidation Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="bg-white/70 dark:bg-slate-900 p-3 rounded-lg space-y-2 border border-gray-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">Target Position:</span>
              <span className="text-slate-800 dark:text-white font-mono">
                {shortenAddress(account.walletAddress)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">Debt Repayment:</span>
              <span className="text-slate-800 dark:text-white font-semibold">
                ${liquidationParams.repayAmountUSD.toLocaleString()} {liquidationParams.repayToken}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">Collateral to Receive:</span>
              <span className="text-ocean-teal font-semibold">
                {liquidationParams.collateralAmount.toFixed(4)} {liquidationParams.collateralToken}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-300">Liquidation Bonus:</span>
              <span className="text-whale-gold font-semibold">
                ${liquidationParams.liquidationBonus.toLocaleString()} (5%)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Message */}
      <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardContent className="pt-4">
          <div className="text-center space-y-3">
            <div className="bg-ocean-teal/10 border border-ocean-teal/30 rounded-lg p-3">
              <p className="text-slate-800 dark:text-white text-lg">
                You are repaying <span className="font-bold text-whale-gold">
                  ${liquidationParams.repayAmountUSD.toLocaleString()}
                </span> of this borrower's debt
              </p>
              <p className="text-slate-600 dark:text-slate-300 mt-2">
                In return, you'll receive <span className="font-bold text-ocean-teal">
                  ~{liquidationParams.collateralAmount.toFixed(4)} {liquidationParams.collateralToken}
                </span> (5% bonus included)
              </p>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <AlertTriangle className="h-4 w-4" />
              <span>This action cannot be undone</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Factor Impact */}
      <Card className="bg-white/50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-800 dark:text-white text-sm">Position Impact</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400 text-sm">Current Health Factor</p>
              <Badge variant="destructive" className="mt-1">
                {account.healthFactor.toFixed(3)}
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400 text-sm">Estimated After</p>
              <Badge variant="secondary" className="mt-1">
                {((account.totalBorrowed - liquidationParams.repayAmountUSD) / 
                  account.totalSupplied * 1.5).toFixed(3)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-3 border-t border-border/50 mt-4">
        <DorkFiButton 
          variant="secondary" 
          onClick={onCancel}
          disabled={isExecuting}
          className="min-h-[44px] min-w-[92px] font-semibold text-sm"
        >
          Cancel
        </DorkFiButton>
        <DorkFiButton 
          variant="danger"
          onClick={handleConfirm}
          disabled={isExecuting}
          className="min-h-[44px] min-w-[140px] font-semibold text-sm"
        >
          {isExecuting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Executing...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Confirm Liquidation
            </div>
          )}
        </DorkFiButton>
      </div>
    </div>
  );
}
