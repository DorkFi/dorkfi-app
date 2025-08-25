
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { shortenAddress } from '@/utils/liquidationUtils';
import { cn } from '@/lib/utils';

interface AccountCardProps {
  account: LiquidationAccount;
  onClick: (account: LiquidationAccount) => void;
}

export default function AccountCard({ account, onClick }: AccountCardProps) {
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

  const getHealthFactorColor = (healthFactor: number) => {
    if (healthFactor <= 1.0) return 'text-destructive';
    if (healthFactor <= 1.1) return 'text-whale-gold';
    if (healthFactor <= 1.2) return 'text-orange-500';
    return 'text-ocean-teal';
  };

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
      onClick={() => onClick(account)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="font-mono text-sm text-ink-blue">
            {shortenAddress(account.walletAddress, 6)}
          </div>
          <Badge variant={getRiskBadgeVariant(account.riskLevel)} className="text-xs">
            {account.riskLevel.toUpperCase()}
          </Badge>
        </div>

        {/* Health Factor */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Health Factor</span>
          <span className={cn('font-bold text-lg', getHealthFactorColor(account.healthFactor))}>
            {account.healthFactor.toFixed(2)}
          </span>
        </div>

        {/* Financial Info */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Collateral</span>
            <span className="font-medium">
              ${account.totalSupplied.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Borrowed</span>
            <span className="font-medium">
              ${account.totalBorrowed.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">LTV</span>
            <span className="font-medium">
              {(account.ltv * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Liquidation Margin</span>
            <span className="font-medium text-whale-gold">
              ${account.liquidationMargin.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
