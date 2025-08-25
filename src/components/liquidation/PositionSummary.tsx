
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiquidationAccount } from '@/hooks/useLiquidationData';

interface PositionSummaryProps {
  account: LiquidationAccount;
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

export default function PositionSummary({ account }: PositionSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Position Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Collateral</span>
            <span className="font-semibold">${account.totalSupplied.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Borrowed</span>
            <span className="font-semibold">${account.totalBorrowed.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Loan-to-Value</span>
            <span className="font-semibold">{(account.ltv * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Liquidation Margin</span>
            <span className="font-semibold text-whale-gold">
              ${account.liquidationMargin.toLocaleString()}
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
            <Badge variant={getRiskBadgeVariant(account.riskLevel)}>
              {account.riskLevel}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Liquidation Threshold</span>
            <span className="font-semibold">85%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Current LTV</span>
            <span className="font-semibold">{(account.ltv * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Buffer</span>
            <span className="font-semibold text-ocean-teal">
              {(85 - account.ltv * 100).toFixed(1)}%
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
