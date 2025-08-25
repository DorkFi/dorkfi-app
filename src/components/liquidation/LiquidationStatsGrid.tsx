
import React from 'react';
import { Users, AlertTriangle, TrendingUp, Shield } from 'lucide-react';
import DorkFiCard from '@/components/ui/DorkFiCard';
import { H3, Caption } from '@/components/ui/Typography';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LiquidationStatsGridProps {
  stats: {
    totalAccounts: number;
    liquidatable: number;
    dangerZone: number;
    safeHarbor: number;
  };
}

export default function LiquidationStatsGrid({ stats }: LiquidationStatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Accounts */}
        <Tooltip>
          <TooltipTrigger asChild>
            <DorkFiCard className="dorkfi-card text-center cursor-pointer hover:scale-105 hover:border-ocean-teal/40">
              <div className="flex flex-row items-center justify-between mb-2">
                <H3 className="dorkfi-h3 text-slate-600 dark:text-muted-foreground text-sm font-medium mb-0">Total Accounts</H3>
                <Users className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalAccounts}</div>
              <Caption className="dorkfi-caption">Active borrowing positions</Caption>
            </DorkFiCard>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total number of accounts with active borrowing positions in the protocol</p>
          </TooltipContent>
        </Tooltip>
        {/* Liquidatable */}
        <Tooltip>
          <TooltipTrigger asChild>
            <DorkFiCard className="dorkfi-card text-center cursor-pointer hover:scale-105 hover:border-ocean-teal/40">
              <div className="flex flex-row items-center justify-between mb-2">
                <H3 className="dorkfi-h3 text-sm font-medium mb-0 text-red-500">Liquidatable</H3>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-500">{stats.liquidatable}</div>
              <Caption className="dorkfi-caption">Health Factor ≤ 1.0</Caption>
            </DorkFiCard>
          </TooltipTrigger>
          <TooltipContent>
            <p>Accounts that can be liquidated immediately (Health Factor ≤ 1.0)</p>
          </TooltipContent>
        </Tooltip>
        {/* Danger Zone */}
        <Tooltip>
          <TooltipTrigger asChild>
            <DorkFiCard className="dorkfi-card text-center cursor-pointer hover:scale-105 hover:border-ocean-teal/40">
              <div className="flex flex-row items-center justify-between mb-2">
                <H3 className="dorkfi-h3 text-sm font-medium mb-0 text-orange-500">Danger Zone</H3>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-orange-500">{stats.dangerZone}</div>
              <Caption className="dorkfi-caption">Health Factor 1.0-1.1</Caption>
            </DorkFiCard>
          </TooltipTrigger>
          <TooltipContent>
            <p>High-risk accounts approaching liquidation (Health Factor 1.0-1.1)</p>
          </TooltipContent>
        </Tooltip>
        {/* Safe Harbor */}
        <Tooltip>
          <TooltipTrigger asChild>
            <DorkFiCard className="dorkfi-card text-center cursor-pointer hover:scale-105 hover:border-ocean-teal/40">
              <div className="flex flex-row items-center justify-between mb-2">
                <H3 className="dorkfi-h3 text-sm font-medium mb-0 text-green-500">Safe Harbor</H3>
                <Shield className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-500">{stats.safeHarbor}</div>
              <Caption className="dorkfi-caption">Health Factor {'>'}= 1.2</Caption>
            </DorkFiCard>
          </TooltipTrigger>
          <TooltipContent>
            <p>Well-collateralized accounts with low liquidation risk (Health Factor {'>'}= 1.2)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
