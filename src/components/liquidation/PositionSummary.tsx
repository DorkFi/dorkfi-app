
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiquidationAccount } from '@/hooks/useLiquidationData';

interface PositionSummaryProps {
  account: LiquidationAccount;
  realTotalDepositValue?: number;
  realTotalBorrowValue?: number;
  realRiskLevel?: string;
  realLiquidationThreshold?: number;
  weightedCollateralValue?: number;
}

const getRiskBadgeVariant = (riskLevel: string) => {
  switch (riskLevel) {
    case 'liquidatable':
      return 'destructive';
    case 'danger':
      return 'secondary';
    case 'moderate':
      return 'outline';
    case 'safe':
    default:
      return 'default';
  }
};

export default function PositionSummary({ 
  account, 
  realTotalDepositValue, 
  realTotalBorrowValue, 
  realRiskLevel,
  realLiquidationThreshold,
  weightedCollateralValue
}: PositionSummaryProps) {
  // Use real data if available, otherwise fall back to account data
  const totalCollateral = realTotalDepositValue ?? account.totalSupplied;
  const totalBorrowed = realTotalBorrowValue ?? account.totalBorrowed;
  
  // Calculate real LTV using weighted collateral value (correct calculation)
  const realLTV = weightedCollateralValue && realTotalBorrowValue 
    ? (realTotalBorrowValue / weightedCollateralValue) * 100 
    : realTotalDepositValue && realTotalBorrowValue 
    ? (realTotalBorrowValue / realTotalDepositValue) * 100  // Fallback to raw collateral if weighted not available
    : account.ltv * 100;

  // Use real liquidation threshold or default to 85%
  const liquidationThreshold = realLiquidationThreshold ?? 85;
  
  // Calculate liquidation margin based on weighted collateral value
  const liquidationMargin = weightedCollateralValue && realTotalBorrowValue
    ? weightedCollateralValue * (liquidationThreshold / 100) - realTotalBorrowValue
    : realTotalDepositValue && realTotalBorrowValue
    ? realTotalDepositValue * (liquidationThreshold / 100) - realTotalBorrowValue  // Fallback to raw collateral
    : account.liquidationMargin;

  // Debug logging to verify calculations
  console.log('PositionSummary Debug:', {
    realTotalDepositValue,
    realTotalBorrowValue,
    weightedCollateralValue,
    liquidationThreshold,
    calculatedLTV: weightedCollateralValue && realTotalBorrowValue 
      ? (realTotalBorrowValue / weightedCollateralValue) * 100 
      : 'N/A',
    calculatedMargin: weightedCollateralValue && realTotalBorrowValue
      ? weightedCollateralValue * (liquidationThreshold / 100) - realTotalBorrowValue
      : 'N/A'
  });

  // Use real risk level or fall back to account risk level
  const riskLevel = realRiskLevel ?? account.riskLevel;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Position Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Collateral</span>
            <span className="font-semibold">${totalCollateral.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Borrowed</span>
            <span className="font-semibold">${totalBorrowed.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Loan-to-Value</span>
            <span className="font-semibold">{realLTV.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Liquidation Margin</span>
            <span className="font-semibold text-whale-gold">
              ${liquidationMargin.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Risk Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Risk Level</span>
            <Badge variant={getRiskBadgeVariant(riskLevel)}>
              {riskLevel}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Liquidation Threshold</span>
            <span className="font-semibold">{liquidationThreshold.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Current LTV</span>
            <span className="font-semibold">{realLTV.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Buffer</span>
            <span className="font-semibold text-ocean-teal">
              {(liquidationThreshold - realLTV).toFixed(1)}%
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
