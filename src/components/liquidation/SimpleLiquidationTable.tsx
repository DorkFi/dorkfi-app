
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Shield, Users, Info } from 'lucide-react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { shortenAddress } from '@/utils/liquidationUtils';
import DorkFiButton from '@/components/ui/DorkFiButton';
import LiquidationMobileCard from './LiquidationMobileCard';

interface SimpleLiquidationTableProps {
  accounts: LiquidationAccount[];
  onAccountClick?: (account: LiquidationAccount) => void;
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

export default function SimpleLiquidationTable({ accounts, onAccountClick }: SimpleLiquidationTableProps) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md">
      {/* Mobile Layout */}
      <div className="block md:hidden">
        <div className="flex flex-col gap-4">
          {accounts.map((account) => (
            <LiquidationMobileCard
              key={account.id}
              account={account}
              onAccountClick={onAccountClick || (() => {})}
            />
          ))}
        </div>
      </div>

      {/* Desktop Layout */}
      <Card className="hidden md:block bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md card-hover hover:border-ocean-teal/40 transition-all">
        <CardHeader>
          <CardTitle className="text-slate-800 dark:text-white">Account Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200/50 dark:border-ocean-teal/20">
                <TableHead className="text-slate-600 dark:text-muted-foreground">Account</TableHead>
                <TableHead className="text-slate-600 dark:text-muted-foreground text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center cursor-help select-none">
                        Health Factor <Info className="w-3 h-3 inline ml-1" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ratio of collateral value to borrowed amount. Below 1.0 = liquidatable</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-slate-600 dark:text-muted-foreground text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center cursor-help select-none">
                        Total Borrowed <Info className="w-3 h-3 inline ml-1" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total USD value of all borrowed assets for this account</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-slate-600 dark:text-muted-foreground text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center cursor-help select-none">
                        LTV <Info className="w-3 h-3 inline ml-1" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Loan-to-Value ratio: borrowed amount / collateral value</p>
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-slate-600 dark:text-muted-foreground">Risk Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const risk = getRiskLevel(account.healthFactor);
                const Icon = risk.icon;

                return (
                  <TableRow 
                    key={account.id}
                    className="cursor-pointer hover:bg-ocean-teal/10 border-gray-200/50 dark:border-ocean-teal/20"
                    onClick={() => onAccountClick?.(account)}
                  >
                    <TableCell className="font-mono text-slate-800 dark:text-white">
                      {shortenAddress(account.walletAddress)}
                    </TableCell>
                    <TableCell className={`font-semibold ${getRiskColor(account.healthFactor)} text-center`}>
                      {account.healthFactor.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-slate-800 dark:text-white text-center">
                      ${account.totalBorrowed.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-slate-800 dark:text-white text-center">
                      {(account.ltv * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <DorkFiButton
                              variant={risk.variant}
                              className="pointer-events-none flex items-center gap-1 px-3 py-1 min-h-[30px] min-w-[90px] rounded-lg text-xs font-semibold shadow-none border-0 cursor-default"
                              tabIndex={-1}
                              aria-disabled
                              type="button"
                            >
                              <Icon className="w-3 h-3" />
                              {risk.level}
                            </DorkFiButton>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {risk.level === 'CRITICAL' && 'Position can be liquidated immediately'}
                            {risk.level === 'HIGH' && 'High risk of liquidation within 24 hours'}
                            {risk.level === 'MODERATE' && 'Moderate risk - monitor regularly'}
                            {risk.level === 'SAFE' && 'Position is healthy and well-collateralized'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Card>
  );
}
