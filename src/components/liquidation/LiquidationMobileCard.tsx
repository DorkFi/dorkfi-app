
import React from 'react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { shortenAddress } from '@/utils/liquidationUtils';
import DorkFiButton from '@/components/ui/DorkFiButton';
import { AlertTriangle, Shield, Users } from 'lucide-react';

interface LiquidationMobileCardProps {
  account: LiquidationAccount;
  onAccountClick: (account: LiquidationAccount) => void;
}

const getRiskColor = (healthFactor: number) => {
  if (healthFactor <= 1.0) return 'text-destructive';
  if (healthFactor <= 1.1) return 'text-accent';
  if (healthFactor <= 1.2) return 'text-whale-gold';
  return 'text-ocean-teal';
};

const getRiskLevel = (healthFactor: number) => {
  if (healthFactor <= 1.0)
    return { level: 'CRITICAL', variant: 'critical' as const, icon: AlertTriangle };
  if (healthFactor <= 1.1)
    return { level: 'HIGH', variant: 'high' as const, icon: AlertTriangle };
  if (healthFactor <= 1.2)
    return { level: 'MODERATE', variant: 'moderate' as const, icon: Users };
  return { level: 'SAFE', variant: 'safe' as const, icon: Shield };
};

export default function LiquidationMobileCard({ account, onAccountClick }: LiquidationMobileCardProps) {
  const risk = getRiskLevel(account.healthFactor);
  const Icon = risk.icon;

  return (
    <div 
      className="rounded-xl card-hover bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 p-4 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md hover:shadow-lg transition-all"
      onClick={() => onAccountClick(account)}
    >
      {/* Risk accent bar */}
      <div className={`h-1 w-full rounded-full mb-3 ${
        risk.level === 'CRITICAL' ? 'bg-destructive' :
        risk.level === 'HIGH' ? 'bg-accent' :
        risk.level === 'MODERATE' ? 'bg-whale-gold' : 'bg-ocean-teal'
      }`} />
      
      <div className="space-y-3">
        {/* Account Address */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Account Address</p>
          <p className="font-mono text-foreground font-medium">
            {shortenAddress(account.walletAddress)}
          </p>
        </div>

        {/* Health Factor - Most Important */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Health Factor</p>
          <p className={`text-2xl font-bold ${getRiskColor(account.healthFactor)}`}>
            {account.healthFactor.toFixed(3)}
          </p>
        </div>

        {/* Two column layout for remaining data */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total Borrowed</p>
            <p className="text-foreground font-semibold">
              ${account.totalBorrowed.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">LTV</p>
            <p className="text-foreground font-semibold">
              {(account.ltv * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Risk Level Badge */}
        <div className="flex justify-between items-center pt-2">
          <DorkFiButton
            variant={risk.variant}
            className="pointer-events-none flex items-center gap-1 px-3 py-1 min-h-[32px] min-w-[80px] rounded-lg text-xs font-semibold shadow-none border-0"
            tabIndex={-1}
            aria-disabled
          >
            <Icon className="w-3 h-3" />
            {risk.level}
          </DorkFiButton>
          <p className="text-xs text-muted-foreground">Tap for details</p>
        </div>
      </div>
    </div>
  );
}
