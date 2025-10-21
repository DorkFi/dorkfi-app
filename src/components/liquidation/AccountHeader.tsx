
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { formatRelativeTime } from '@/utils/liquidationUtils';

interface AccountHeaderProps {
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

export default function AccountHeader({ account }: AccountHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-mono text-lg font-semibold text-ink-blue break-all">
            {account.walletAddress}
          </h3>
          <p className="text-sm text-muted-foreground">
            Last updated: {formatRelativeTime(parseInt(account.lastUpdated))}
          </p>
        </div>
        <Badge variant={getRiskBadgeVariant(account.riskLevel)} className="w-fit">
          {account.riskLevel.toUpperCase()} RISK
        </Badge>
      </div>
    </div>
  );
}
