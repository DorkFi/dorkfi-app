import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DorkFiButton from '@/components/ui/DorkFiButton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, ExternalLink, AlertTriangle, Shield, Users } from 'lucide-react';
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { shortenAddress, formatRelativeTime } from '@/utils/liquidationUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import LiquidationMobileCard from '@/components/liquidation/LiquidationMobileCard';


interface LiquidationQueueTableProps {
  accounts: LiquidationAccount[];
  onAccountClick?: (account: LiquidationAccount) => void;
  onLiquidateNow?: (account: LiquidationAccount) => void;
}

const getRiskColor = (healthFactor: number) => {
  if (healthFactor <= 1.0) return 'text-red-500';
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

const getTokenIcon = (symbol: string) => {
  const iconMap: { [key: string]: string } = {
    'VOI': '/lovable-uploads/eb092f67-df8a-436b-9ea3-a71f6a1bdf05.png',
    'UNIT': '/lovable-uploads/d5c8e461-2034-4190-89ee-f422760c3e12.png',
    'USDC': '/lovable-uploads/17b0dffb-5ea8-4bef-9173-28bb7b41bc06.png',
    'ALGO': '/lovable-uploads/86303552-f96f-4fee-b61a-7e69d7c17ef0.png',
    'ETH': '/lovable-uploads/0056095969b13247cc2220891bbf5caf.jpg',
    'BTC': '/lovable-uploads/e6939307-812a-4a73-b7e5-e159df44e40c.png',
  };
  return iconMap[symbol] || '/placeholder.svg';
};

export default function LiquidationQueueTable({ accounts, onAccountClick, onLiquidateNow }: LiquidationQueueTableProps) {
  const isMobile = useIsMobile();
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200/50 dark:border-ocean-teal/20 shadow-md hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold text-slate-800 dark:text-white">
              Liquidation Queue
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 hidden md:block">
              Real-time monitoring of positions eligible for liquidation
            </p>
            
            {/* Educational Content */}
            <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400 hidden md:block">
              <p>• Borrowers who fail to maintain enough collateral are at risk of liquidation.</p>
              <p>• Liquidators repay part of their debt and receive discounted collateral as a reward.</p>
              <p>• Stay sharp — snipe bad debt and earn yield while helping keep the system healthy.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://docs.dork.fi/liquidations', '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-2 bg-ocean-teal/5 border-ocean-teal/20 hover:bg-ocean-teal/10 text-ocean-teal"
            >
              Learn More
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Badge variant="outline" className="bg-ocean-teal/10 border-ocean-teal/20 text-ocean-teal hidden md:inline-flex">
              {accounts.length} Active Positions
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isMobile ? (
          <div className="space-y-3">
            {accounts.map((account, index) => (
              <div key={account.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-fade-in">
                <LiquidationMobileCard account={account} onAccountClick={(acc) => onAccountClick?.(acc)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200/50 dark:border-ocean-teal/20">
                  <TableHead className="text-slate-600 dark:text-muted-foreground text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Health Factor</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Position health ratio. Below 1.0 = liquidatable</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-muted-foreground text-right hidden md:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Collateral</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total USD value of all collateral assets</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-muted-foreground text-right hidden md:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Borrow Value</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total USD value of borrowed assets</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-muted-foreground text-left hidden md:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Wallet</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Borrower's wallet address and last update time</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-slate-600 dark:text-muted-foreground text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Actions</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Liquidate position or view detailed information</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account, index) => {
                  const risk = getRiskBadge(account.healthFactor);
                  const Icon = risk.icon;
                  const healthPercentage = Math.min(account.healthFactor * 50, 100);

                  return (
                    <TableRow 
                      key={account.id}
                      className="cursor-pointer hover:bg-ocean-teal/5 border-gray-200/50 dark:border-ocean-teal/20 transition-all duration-200 hover:shadow-sm animate-fade-in"
                      onClick={() => onAccountClick?.(account)}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <TableCell className="text-center">
                        <div className="space-y-1 md:space-y-2">
                          <div className="flex items-center justify-center gap-1 md:gap-2">
                            <span className={`font-semibold text-sm ${getRiskColor(account.healthFactor)}`}>
                              {account.healthFactor.toFixed(3)}
                            </span>
                            <Badge variant={risk.variant} className="flex items-center gap-1 text-xs px-1 py-0">
                              <Icon className="w-2 h-2 md:w-3 md:h-3" />
                              <span className="hidden md:inline">{risk.level}</span>
                            </Badge>
                          </div>
                          <Progress 
                            value={healthPercentage} 
                            className="h-1 md:h-2"
                            style={{
                              // @ts-ignore
                              '--progress-background': account.healthFactor <= 1.0 ? '#ef4444' : 
                                                   account.healthFactor <= 1.1 ? '#f59e0b' : 
                                                   account.healthFactor <= 1.5 ? '#eab308' : '#22c55e'
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            ${account.totalSupplied.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total Collateral
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            ${account.totalBorrowed.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total Borrowed
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-left">
                        <div className="font-mono text-sm">
                          <p className="font-medium text-foreground">
                            {shortenAddress(account.walletAddress)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Updated {formatRelativeTime(parseInt(account.lastUpdated))}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 md:gap-2">
                          {account.healthFactor <= 1.0 && (
                            <DorkFiButton
                              variant="danger-outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLiquidateNow?.(account);
                              }}
                              className="hover:scale-105 transition-all text-xs md:text-sm"
                            >
                              <span className="hidden md:inline">Liquidate Now</span>
                              <span className="md:hidden">Liquidate</span>
                            </DorkFiButton>
                          )}
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAccountClick?.(account);
                                }}
                                className="hover:bg-ocean-teal/10 hover:scale-105 transition-all p-1 md:p-2"
                              >
                                <Eye className="h-3 w-3 md:h-4 md:w-4" />
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
                                className="hover:bg-ocean-teal/10 hover:scale-105 transition-all p-1 md:p-2 hidden md:flex"
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
