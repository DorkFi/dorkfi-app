
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ExternalLink, Eye, AlertTriangle, Shield, Users } from 'lucide-react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { shortenAddress } from '@/utils/liquidationUtils';

interface EnhancedLiquidationTableProps {
  accounts: LiquidationAccount[];
  onAccountClick?: (account: LiquidationAccount) => void;
}

const getRiskColor = (healthFactor: number) => {
  if (healthFactor <= 1.0) return 'text-destructive';
  if (healthFactor <= 1.1) return 'text-amber-500';
  if (healthFactor <= 1.5) return 'text-yellow-500';
  return 'text-emerald-500';
};

const getRiskBadge = (healthFactor: number) => {
  if (healthFactor <= 1.0) return { level: 'CRITICAL', variant: 'destructive' as const, icon: AlertTriangle };
  if (healthFactor <= 1.1) return { level: 'HIGH', variant: 'secondary' as const, icon: AlertTriangle };
  if (healthFactor <= 1.5) return { level: 'MODERATE', variant: 'outline' as const, icon: Users };
  return { level: 'SAFE', variant: 'default' as const, icon: Shield };
};

export default function EnhancedLiquidationTable({ accounts, onAccountClick }: EnhancedLiquidationTableProps) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-slate-800 dark:text-white">
              Liquidation Queue
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time monitoring of at-risk positions
            </p>
          </div>
          <Badge variant="outline" className="bg-ocean-teal/10 border-ocean-teal/20">
            {accounts.length} Accounts
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200/50 dark:border-ocean-teal/20">
              <TableHead className="text-slate-600 dark:text-muted-foreground">Account</TableHead>
              <TableHead className="text-slate-600 dark:text-muted-foreground">Health Factor</TableHead>
              <TableHead className="text-slate-600 dark:text-muted-foreground">Risk Level</TableHead>
              <TableHead className="text-slate-600 dark:text-muted-foreground">Total Borrowed</TableHead>
              <TableHead className="text-slate-600 dark:text-muted-foreground">LTV</TableHead>
              <TableHead className="text-slate-600 dark:text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const risk = getRiskBadge(account.healthFactor);
              const Icon = risk.icon;
              const healthPercentage = Math.min(account.healthFactor * 50, 100);

              return (
                <TableRow 
                  key={account.id}
                  className="cursor-pointer hover:bg-ocean-teal/5 border-gray-200/50 dark:border-ocean-teal/20 transition-colors"
                  onClick={() => onAccountClick?.(account)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-ocean-teal to-deep-sea-navy rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {account.walletAddress.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-mono text-sm font-medium text-foreground">
                          {shortenAddress(account.walletAddress)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated {account.lastUpdated}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${getRiskColor(account.healthFactor)}`}>
                          {account.healthFactor.toFixed(3)}
                        </span>
                      </div>
                      <Progress 
                        value={healthPercentage} 
                        className="h-1"
                        style={{
                          // @ts-ignore
                          '--progress-background': account.healthFactor <= 1.0 ? '#ef4444' : 
                                                   account.healthFactor <= 1.1 ? '#f59e0b' : 
                                                   account.healthFactor <= 1.5 ? '#eab308' : '#22c55e'
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={risk.variant} className="flex items-center gap-1 w-fit">
                      <Icon className="w-3 h-3" />
                      {risk.level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        ${account.totalBorrowed.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supplied: ${account.totalSupplied.toLocaleString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">
                        {(account.ltv * 100).toFixed(1)}%
                      </p>
                      <div className="w-full bg-muted rounded-full h-1 mt-1">
                        <div 
                          className="h-1 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500"
                          style={{ width: `${account.ltv * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAccountClick?.(account);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Details</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Open in blockchain explorer
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View on Explorer</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
