
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Info, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import MarketsTableActions from "./MarketsTableActions";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import APYDisplay from "@/components/APYDisplay";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";
import STokenRow from "./STokenRow";
import React, { useState, useEffect, useMemo } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@txnlab/use-wallet-react";
import { getTokenConfig, getAllTokensWithDisplayInfo, getNetworkConfig } from "@/config";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";

interface MarketsDesktopTableProps {
  markets: OnDemandMarketData[];
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string, poolId?: string) => void;
  onBorrowClick: (asset: string, poolId?: string) => void;
  onMintClick?: (asset: string, poolId?: string) => void;
  onMigrateClick?: (asset: string) => void;
  isLoadingBalance?: boolean;
}

const headerTooltips = {
  asset: "The asset/token available for lending or borrowing.",
  totalDeposit: "Total value currently deposited by all users in this market.",
  depositAPY: "Annual Percentage Yield received for depositing this asset.",
  totalBorrow: "Total value currently borrowed in this market.",
  borrowAPY: "Annual Percentage Yield charged for borrowing this asset.",
  utilization: "Percentage of deposited assets that are currently borrowed.",
  actions: "Quick actions to deposit or borrow the selected asset.",
};

const LoadingCell = () => (
  <div className="flex items-center justify-center gap-2 text-muted-foreground">
    <Loader2 className="w-4 h-4 animate-spin" />
    <span className="text-sm">Loading...</span>
  </div>
);

const ErrorCell = ({ error }: { error: string }) => (
  <div className="flex items-center justify-center text-red-500 text-sm">
    Error: {error}
  </div>
);

const MarketsDesktopTable = ({
  markets,
  onRowClick,
  onInfoClick,
  onDepositClick,
  onBorrowClick,
  onMintClick,
  onMigrateClick,
  isLoadingBalance = false,
}: MarketsDesktopTableProps) => {
  const { currentNetwork } = useNetwork();
  const { activeAccount } = useWallet();
  const [migrationBalances, setMigrationBalances] = useState<
    Record<string, string | null>
  >({});
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());

  // Helper function to get market label (A or B) based on poolId
  const getMarketLabel = (market: OnDemandMarketData, marketIndex?: number): string | null => {
    const networkConfig = getNetworkConfig(currentNetwork);
    const lendingPools = networkConfig.contracts.lendingPools;
    
    // Try to get poolId from multiple sources
    let poolId: string | null = null;
    
    // Priority 1: From marketInfo (most reliable)
    poolId = market.marketInfo?.poolId || null;
    
    // Priority 2: From market.poolId
    if (!poolId) {
      poolId = market.poolId || null;
    }
    
    // Priority 3: Try to match market to token config by poolId
    if (!poolId) {
      const tokenConfigRaw = networkConfig.tokens[market.asset];
      if (Array.isArray(tokenConfigRaw)) {
        // Try to find matching config by comparing poolIds from market data
        // First check if we can match by marketInfo or market.poolId
        const marketPoolId = market.marketInfo?.poolId || market.poolId;
        if (marketPoolId) {
          const matchingConfig = tokenConfigRaw.find(tc => String(tc.poolId) === String(marketPoolId));
          if (matchingConfig) {
            poolId = matchingConfig.poolId;
          }
        }
        
        // If still no match and index provided, try by index
        if (!poolId && marketIndex !== undefined && tokenConfigRaw[marketIndex]?.poolId) {
          poolId = tokenConfigRaw[marketIndex].poolId;
        }
        
        // Final fallback: use first entry
        if (!poolId && tokenConfigRaw.length > 0) {
          poolId = tokenConfigRaw[0]?.poolId || null;
        }
      } else if (tokenConfigRaw) {
        poolId = tokenConfigRaw.poolId || null;
      }
    }
    
    // Determine label from poolId
    if (poolId && lendingPools.length >= 2) {
      // Compare as strings to ensure exact match
      if (String(poolId) === String(lendingPools[0])) return "A";
      if (String(poolId) === String(lendingPools[1])) return "B";
    }
    
    return null;
  };

  // Check migration balances for markets that have migration property
  useEffect(() => {
    const checkMigrationBalances = async () => {
      if (!activeAccount?.address) {
        setMigrationBalances({});
        return;
      }

      const balances: Record<string, string | null> = {};
      const tokens = getAllTokensWithDisplayInfo(currentNetwork);

      // Initialize ARC200Service
      try {
        const clients = await algorandService.getCurrentClientsForReads();
        ARC200Service.initialize(clients);

        // Check balance for each market that has migration
        for (const market of markets) {
          if (market.isSToken) continue;

          const token = tokens.find((t) => t.symbol === market.asset);
          const originalSymbol =
            token && "originalSymbol" in token
              ? (token as any).originalSymbol
              : market.asset;
          const tokenConfigRaw = getTokenConfig(currentNetwork, originalSymbol);
          const tokenConfig = Array.isArray(tokenConfigRaw)
            ? tokenConfigRaw[0]
            : tokenConfigRaw;

          if (tokenConfig?.migration?.nTokenId) {
            try {
              const balance = await ARC200Service.getBalance(
                activeAccount.address,
                tokenConfig.migration.nTokenId
              );
              // Format balance if > 0 (balance is returned as string in base units)
              if (balance && BigInt(balance) > 0n) {
                const formattedBalance = ARC200Service.formatBalance(
                  balance,
                  tokenConfig.decimals
                );
                // Format to 2 decimal places
                balances[market.asset] = parseFloat(formattedBalance).toFixed(2);
              } else {
                balances[market.asset] = null;
              }
            } catch (error) {
              console.error(
                `Error checking migration balance for ${market.asset}:`,
                error
              );
              balances[market.asset] = null;
            }
          }
        }

        setMigrationBalances(balances);
      } catch (error) {
        console.error("Error initializing ARC200Service:", error);
      }
    };

    checkMigrationBalances();
  }, [markets, activeAccount?.address, currentNetwork]);

  // Helper to get poolId for sorting
  const getPoolIdForSorting = (market: OnDemandMarketData, index?: number): string | null => {
    // Priority 1: From marketInfo (most reliable when loaded)
    let poolId = market.marketInfo?.poolId;
    
    // Priority 2: From market.poolId (set during initialization)
    if (!poolId) {
      poolId = market.poolId || null;
    }
    
    // Priority 3: From token config
    if (!poolId) {
      const networkConfig = getNetworkConfig(currentNetwork);
      const tokenConfigRaw = networkConfig.tokens[market.asset];
      if (Array.isArray(tokenConfigRaw)) {
        if (index !== undefined && tokenConfigRaw[index]?.poolId) {
          poolId = tokenConfigRaw[index].poolId;
        } else if (tokenConfigRaw.length > 0) {
          poolId = tokenConfigRaw[0]?.poolId;
        }
      } else if (tokenConfigRaw) {
        poolId = tokenConfigRaw.poolId;
      }
    }
    return poolId || null;
  };

  // Helper to check if market is A market
  const isAMarket = (market: OnDemandMarketData, index?: number): boolean => {
    const poolId = getPoolIdForSorting(market, index);
    if (!poolId) return false;
    const networkConfig = getNetworkConfig(currentNetwork);
    const lendingPools = networkConfig.contracts.lendingPools;
    return lendingPools.length >= 1 && String(poolId) === String(lendingPools[0]);
  };

  // Group markets by symbol
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, OnDemandMarketData[]> = {};
    const networkConfig = getNetworkConfig(currentNetwork);
    const lendingPools = networkConfig.contracts.lendingPools;
    
    markets.forEach((market) => {
      const key = market.asset;
      if (!groups[key]) {
        groups[key] = [];
      }
      // Only add if not already present (check by poolId to avoid duplicates)
      const existingMarket = groups[key].find(
        (m) => m.marketInfo?.poolId === market.marketInfo?.poolId
      );
      if (!existingMarket) {
        groups[key].push(market);
      }
    });
    
    // Sort markets within each group: A markets first, then B markets
    Object.keys(groups).forEach((symbol) => {
      groups[symbol].sort((a, b) => {
        const poolIdA = getPoolIdForSorting(a);
        const poolIdB = getPoolIdForSorting(b);
        
        if (!poolIdA || !poolIdB) return 0;
        
        // A markets come before B markets
        const isAA = String(poolIdA) === String(lendingPools[0]);
        const isAB = String(poolIdA) === String(lendingPools[1]);
        const isBA = String(poolIdB) === String(lendingPools[0]);
        const isBB = String(poolIdB) === String(lendingPools[1]);
        
        if (isAA && (isAB || isBB)) return -1;
        if ((isAB || isBB) && isBA) return 1;
        return 0;
      });
    });
    
    // Sort groups alphabetically
    const sortedGroups: Record<string, OnDemandMarketData[]> = {};
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      return a.localeCompare(b);
    });
    
    sortedKeys.forEach((key) => {
      sortedGroups[key] = groups[key];
    });
    
    return sortedGroups;
  }, [markets, currentNetwork]);

  const toggleExpand = (symbol: string) => {
    setExpandedSymbols((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  };

  // Helper function to render a single market row
  const renderMarketRow = (
    market: OnDemandMarketData,
    isNested: boolean = false,
    key?: string,
    marketIndex?: number
  ) => {
    // Render special row for s-tokens
    if (market.isSToken) {
      return (
        <STokenRow
          key={key || market.asset}
          market={market}
          onRowClick={onRowClick}
          onInfoClick={onInfoClick}
          onDepositClick={onDepositClick}
          onBorrowClick={onBorrowClick}
          onMintClick={onMintClick}
          isLoadingBalance={isLoadingBalance}
          isNested={isNested}
          marketIndex={marketIndex}
        />
      );
    }

    // Render regular row for non-s-tokens
    return (
      <TableRow
        key={key || `${market.asset}-${market.marketInfo?.poolId || 'default'}`}
        className={`transition-all relative card-hover rounded-lg border border-gray-200/30 dark:border-ocean-teal/10 bg-white/50 dark:bg-slate-800/50 hover:border-teal-400 hover:shadow-[0_0_16px_4px_rgba(13,255,190,0.15)] hover:z-20 cursor-pointer ${
          isNested ? "bg-gray-50/50 dark:bg-slate-700/50" : ""
        }`}
        onClick={() => onRowClick(market)}
      >
        <TableCell className="text-left align-top">
          <div className="flex items-center gap-3 w-full justify-between">
            <div className="flex items-center gap-3">
              {isNested && <div className="w-6" />}
              {/* Asset icon with market label badge */}
              <div className="relative flex-shrink-0">
                <img
                  src={market.icon}
                  alt={market.asset}
                  className="w-10 h-10 rounded-full object-contain"
                />
                {(() => {
                  // For nested rows (expanded), always show badge based on index
                  // Markets are sorted: A first (index 0), then B (index 1)
                  if (isNested && typeof marketIndex === 'number') {
                    const marketLabel = marketIndex === 0 ? "A" : marketIndex === 1 ? "B" : null;
                    if (marketLabel) {
                      const bgColor = marketLabel === "A" 
                        ? "bg-blue-500 dark:bg-blue-600" 
                        : "bg-purple-500 dark:bg-purple-600";
                      return (
                        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${bgColor} border-2 border-white dark:border-slate-800 flex items-center justify-center`}>
                          <span className="text-xs font-bold text-white">{marketLabel}</span>
                        </div>
                      );
                    }
                  }
                  
                  // For non-nested rows, try to determine label from poolId
                  const networkConfig = getNetworkConfig(currentNetwork);
                  const lendingPools = networkConfig.contracts.lendingPools;
                  
                  let marketLabel: string | null = null;
                  
                  // Try to get poolId
                  let poolId: string | null = market.marketInfo?.poolId || market.poolId || null;
                  
                  if (!poolId) {
                    poolId = getPoolIdForSorting(market, marketIndex);
                  }
                  
                  // Determine label from poolId
                  if (poolId && lendingPools.length >= 2) {
                    if (String(poolId) === String(lendingPools[0])) {
                      marketLabel = "A";
                    } else if (String(poolId) === String(lendingPools[1])) {
                      marketLabel = "B";
                    }
                  }
                  
                  // Fallback: try getMarketLabel
                  if (!marketLabel) {
                    marketLabel = getMarketLabel(market, marketIndex);
                  }
                  
                  if (marketLabel) {
                    const bgColor = marketLabel === "A" 
                      ? "bg-blue-500 dark:bg-blue-600" 
                      : "bg-purple-500 dark:bg-purple-600";
                    return (
                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${bgColor} border-2 border-white dark:border-slate-800 flex items-center justify-center`}>
                        <span className="text-xs font-bold text-white">{marketLabel}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              {/* Asset name and CF badge stacked */}
              <div className="flex flex-col items-center">
                <div className="font-extrabold text-lg leading-tight">
                  {market.asset}
                </div>
                <Badge variant="outline" className="text-xs px-2.5 py-0.5 h-5 mt-1 text-muted-foreground flex items-center justify-center whitespace-nowrap min-w-fit">
                  CF {Math.round(market.collateralFactor)}%
                </Badge>
              </div>
            </div>
            {/* Spacer to align with collapsible rows */}
            <div className="w-6 flex-shrink-0" />
          </div>
        </TableCell>
        <TableCell className="text-center">
          {market.isLoading ? (
            <LoadingCell />
          ) : market.error ? (
            <ErrorCell error={market.error} />
          ) : (
            <div>
              <div className="font-medium">
                ${(market.totalSupplyUSD / 1_000_000).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                {market.totalSupply.toLocaleString(undefined, { maximumFractionDigits: 3 })} {market.asset}
              </div>
            </div>
          )}
        </TableCell>
        <TableCell className="text-center">
          {market.isLoading ? (
            <LoadingCell />
          ) : market.error ? (
            <ErrorCell error={market.error} />
          ) : (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <APYDisplay 
                apyCalculation={market.apyCalculation}
                fallbackAPY={market.supplyAPY}
                showTooltip={true}
              />
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-center">
          {market.isLoading ? (
            <LoadingCell />
          ) : market.error ? (
            <ErrorCell error={market.error} />
          ) : (
            <div>
              <div className="font-medium">
                ${(market.totalBorrowUSD / 1_000_000).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                {market.totalBorrow.toLocaleString(undefined, { maximumFractionDigits: 3 })} {market.asset}
              </div>
            </div>
          )}
        </TableCell>
        <TableCell className="text-center">
          {market.isLoading ? (
            <LoadingCell />
          ) : market.error ? (
            <ErrorCell error={market.error} />
          ) : (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              <BorrowAPYDisplay 
                apyCalculation={market.apyCalculation}
                fallbackAPY={market.borrowAPY}
                showTooltip={true}
              />
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-center">
          {market.isLoading ? (
            <LoadingCell />
          ) : market.error ? (
            <ErrorCell error={market.error} />
          ) : market.asset === "WAD" ? (
            <span></span>
          ) : (
            <div className="flex flex-col items-center space-y-1">
              <div className="text-sm font-medium">
                {market.isSToken ? "100.0" : market.utilization.toFixed(1)}%
              </div>
              <div className="flex justify-center w-full">
                <Progress value={market.isSToken ? 100 : market.utilization} className="h-2 w-20" />
              </div>
            </div>
          )}
        </TableCell>
        <TableCell className="text-center">
          {(() => {
            // Get token to access originalSymbol if market override exists
            const tokens = getAllTokensWithDisplayInfo(currentNetwork);
            
            // Find the correct token for this market
            // Priority: 1) match by symbol + poolId from marketInfo, 2) match by symbol + poolId from market.poolId, 3) match by marketIndex, 4) first match by symbol
            let token: typeof tokens[0] | undefined;
            let poolId: string | undefined;
            
            // First, try to get poolId from marketInfo (most reliable)
            if (market.marketInfo?.poolId) {
              poolId = market.marketInfo.poolId;
              token = tokens.find(
                (t) => t.symbol === market.asset && t.poolId === poolId
              );
            }
            
            // Second, try to match by market.poolId if available
            if (!token && market.poolId) {
              poolId = market.poolId;
              token = tokens.find(
                (t) => t.symbol === market.asset && t.poolId === poolId
              );
            }
            
            // If not found, try to find all tokens with this symbol and match by position/index
            // This is a fallback when marketInfo isn't loaded yet
            if (!token) {
              const matchingTokens = tokens.filter((t) => t.symbol === market.asset);
              if (matchingTokens.length === 1) {
                // Only one token with this symbol, use it
                token = matchingTokens[0];
                poolId = token.poolId;
              } else if (matchingTokens.length > 1) {
                // Multiple tokens - use marketIndex if available, otherwise use first as fallback
                if (marketIndex !== undefined && marketIndex < matchingTokens.length) {
                  token = matchingTokens[marketIndex];
                  poolId = token.poolId;
                } else {
                  console.warn(
                    `Multiple tokens found for ${market.asset}, marketInfo not loaded and no marketIndex. Using first token.`,
                    { matchingTokens: matchingTokens.map((t) => ({ symbol: t.symbol, poolId: t.poolId })) }
                  );
                  token = matchingTokens[0];
                  poolId = token.poolId;
                }
              }
            }
            
            // Final fallback: find any token with matching symbol
            if (!token) {
              token = tokens.find((t) => t.symbol === market.asset);
              poolId = token?.poolId;
            }
            
            const originalSymbol =
              token && "originalSymbol" in token
                ? (token as any).originalSymbol
                : market.asset;
            const tokenConfigRaw = getTokenConfig(
              currentNetwork,
              originalSymbol
            );
            const tokenConfig = Array.isArray(tokenConfigRaw)
              ? tokenConfigRaw.find((tc) => tc.poolId === token?.poolId) || tokenConfigRaw[0]
              : tokenConfigRaw;
            const hasMigration = !!tokenConfig?.migration;
            const migrationBalance = migrationBalances[market.asset];

            // Use poolId from market object (most reliable - set when market data is loaded)
            // Fallback to token poolId, then marketInfo poolId
            const finalPoolId = market.poolId || token?.poolId || poolId || market.marketInfo?.poolId;
            
            console.log("=== MARKETS TABLE ACTIONS DEBUG ===", {
              asset: market.asset,
              marketPoolId: market.poolId,
              marketInfoPoolId: market.marketInfo?.poolId,
              tokenPoolId: token?.poolId,
              finalPoolId,
              hasMarketInfo: !!market.marketInfo,
            });

            return (
              <MarketsTableActions
                asset={market.asset}
                poolId={finalPoolId}
                onDepositClick={onDepositClick}
                onBorrowClick={onBorrowClick}
                onMintClick={onMintClick}
                onMigrateClick={
                  onMigrateClick &&
                  hasMigration &&
                  migrationBalance
                    ? onMigrateClick
                    : undefined
                }
                migrationBalance={migrationBalance || undefined}
                isLoadingBalance={isLoadingBalance}
                isSToken={market.isSToken}
              />
            );
          })()}
        </TableCell>
      </TableRow>
    );
  };

  if (markets.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-ink-blue">
          No markets found matching your search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-visible overflow-visible w-full">
      <div className="rounded-lg border bg-white/50 dark:bg-slate-800/50 border-gray-200/30 dark:border-ocean-teal/10 shadow-md overflow-visible w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  Asset
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Info className="w-4 h-4 text-ocean-teal cursor-help" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {headerTooltips.asset}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  Total Deposits
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Info className="w-4 h-4 text-ocean-teal cursor-help" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {headerTooltips.totalDeposit}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  Deposit APY
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Info className="w-4 h-4 text-ocean-teal cursor-help" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {headerTooltips.depositAPY}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  Total Borrow
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Info className="w-4 h-4 text-ocean-teal cursor-help" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {headerTooltips.totalBorrow}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  Borrow APY
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Info className="w-4 h-4 text-ocean-teal cursor-help" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {headerTooltips.borrowAPY}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  Utilization
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Info className="w-4 h-4 text-ocean-teal cursor-help" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {headerTooltips.utilization}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  Actions
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Info className="w-4 h-4 text-ocean-teal cursor-help" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {headerTooltips.actions}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedMarkets).map(([symbol, symbolMarkets]) => {
              const hasMultipleMarkets = symbolMarkets.length > 1;
              const isExpanded = expandedSymbols.has(symbol);
              const firstMarket = symbolMarkets[0];

              // If only one market, render it directly
              if (!hasMultipleMarkets) {
                return renderMarketRow(firstMarket, false, symbol, 0);
              }

              // Find the highest level market (by totalSupplyUSD)
              const highestMarket = symbolMarkets.reduce((prev, current) => {
                const prevSupply = prev.totalSupplyUSD || 0;
                const currentSupply = current.totalSupplyUSD || 0;
                return currentSupply > prevSupply ? current : prev;
              });

              // If multiple markets, render collapsible row
              return (
                <React.Fragment key={symbol}>
                  {/* Main collapsible row */}
                <TableRow
                    className="transition-all relative card-hover rounded-lg border border-gray-200/30 dark:border-ocean-teal/10 bg-white/50 dark:bg-slate-800/50 hover:border-teal-400 hover:shadow-[0_0_16px_4px_rgba(13,255,190,0.15)] hover:z-20"
                >
                  <TableCell className="text-left align-top">
                      <div className="flex items-center gap-3 w-full justify-between">
                        <div className="flex items-center gap-3">
                          {/* Asset icon with market label badge (only when collapsed) */}
                          <div className="relative flex-shrink-0">
                            <img
                              src={firstMarket.icon}
                              alt={firstMarket.asset}
                              className="w-10 h-10 rounded-full object-contain"
                            />
                            {!isExpanded && (() => {
                              // For collapsed header, show badge for the highest market
                              let marketLabel: string | null = null;
                              const networkConfig = getNetworkConfig(currentNetwork);
                              const lendingPools = networkConfig.contracts.lendingPools;
                              
                              // Get poolId from highest market
                              let poolId: string | null = 
                                highestMarket.marketInfo?.poolId || 
                                highestMarket.poolId || 
                                null;
                              
                              // If poolId not on market, get from token config
                              if (!poolId) {
                                const tokenConfigRaw = networkConfig.tokens[highestMarket.asset];
                                if (Array.isArray(tokenConfigRaw) && tokenConfigRaw.length > 0) {
                                  // Find matching config by comparing with highest market
                                  const matchingConfig = tokenConfigRaw.find(tc => {
                                    const marketPoolId = highestMarket.marketInfo?.poolId || highestMarket.poolId;
                                    return tc.poolId === marketPoolId;
                                  });
                                  poolId = matchingConfig?.poolId || tokenConfigRaw[0]?.poolId || null;
                                } else if (tokenConfigRaw && !Array.isArray(tokenConfigRaw)) {
                                  poolId = tokenConfigRaw.poolId || null;
                                }
                              }
                              
                              // Determine label from poolId
                              if (poolId && lendingPools.length >= 2) {
                                if (String(poolId) === String(lendingPools[0])) {
                                  marketLabel = "A";
                                } else if (String(poolId) === String(lendingPools[1])) {
                                  marketLabel = "B";
                                }
                              }
                              
                              // If still no label, try getMarketLabel as fallback
                              if (!marketLabel) {
                                marketLabel = getMarketLabel(highestMarket, 0);
                              }
                              
                              // Always show badge when collapsed if we have multiple markets
                              if (!marketLabel && hasMultipleMarkets) {
                                marketLabel = "A";
                              }
                              
                              if (marketLabel) {
                                const bgColor = marketLabel === "A" 
                                  ? "bg-blue-500 dark:bg-blue-600" 
                                  : "bg-purple-500 dark:bg-purple-600";
                                return (
                                  <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${bgColor} border-2 border-white dark:border-slate-800 flex items-center justify-center`}>
                                    <span className="text-xs font-bold text-white">{marketLabel}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                      {/* Asset name and CF badge stacked */}
                      <div className="flex flex-col items-center">
                            <div className="font-extrabold text-lg leading-tight">
                              {firstMarket.asset}
                      </div>
                            <Badge variant="outline" className="text-xs px-2.5 py-0.5 h-5 mt-1 text-muted-foreground flex items-center justify-center whitespace-nowrap min-w-fit">
                              CF {Math.round(firstMarket.collateralFactor)}%
                            </Badge>
                    </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(symbol);
                          }}
                          className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {highestMarket.isLoading ? (
                      <LoadingCell />
                    ) : highestMarket.error ? (
                      <ErrorCell error={highestMarket.error} />
                    ) : (
                      <div>
                        <div className="font-medium">
                          ${(highestMarket.totalSupplyUSD / 1_000_000).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {highestMarket.totalSupply.toLocaleString(undefined, { maximumFractionDigits: 3 })} {highestMarket.asset}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {highestMarket.isLoading ? (
                      <LoadingCell />
                    ) : highestMarket.error ? (
                      <ErrorCell error={highestMarket.error} />
                    ) : (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <APYDisplay 
                          apyCalculation={highestMarket.apyCalculation}
                          fallbackAPY={highestMarket.supplyAPY}
                          showTooltip={true}
                        />
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {highestMarket.isLoading ? (
                      <LoadingCell />
                    ) : highestMarket.error ? (
                      <ErrorCell error={highestMarket.error} />
                    ) : (
                      <div>
                        <div className="font-medium">
                          ${(highestMarket.totalBorrowUSD / 1_000_000).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {highestMarket.totalBorrow.toLocaleString(undefined, { maximumFractionDigits: 3 })} {highestMarket.asset}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {highestMarket.isLoading ? (
                      <LoadingCell />
                    ) : highestMarket.error ? (
                      <ErrorCell error={highestMarket.error} />
                    ) : (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        <BorrowAPYDisplay 
                          apyCalculation={highestMarket.apyCalculation}
                          fallbackAPY={highestMarket.borrowAPY}
                          showTooltip={true}
                        />
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {highestMarket.isLoading ? (
                      <LoadingCell />
                    ) : highestMarket.error ? (
                      <ErrorCell error={highestMarket.error} />
                    ) : highestMarket.asset === "WAD" ? (
                      <span></span>
                    ) : (
                      <div className="flex flex-col items-center space-y-1">
                        <div className="text-sm font-medium">
                          {highestMarket.isSToken ? "100.0" : highestMarket.utilization.toFixed(1)}%
                        </div>
                        <div className="flex justify-center w-full">
                          <Progress value={highestMarket.isSToken ? 100 : highestMarket.utilization} className="h-2 w-20" />
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      // Get token to access originalSymbol if market override exists
                      const tokens = getAllTokensWithDisplayInfo(currentNetwork);
                      
                      // Find the correct token for the highest market
                      let token: typeof tokens[0] | undefined;
                      let poolId: string | undefined;
                      
                      // First, try to get poolId from marketInfo (most reliable)
                      if (highestMarket.marketInfo?.poolId) {
                        poolId = highestMarket.marketInfo.poolId;
                        token = tokens.find(
                          (t) => t.symbol === highestMarket.asset && t.poolId === poolId
                        );
                      }
                      
                      // If not found, try to find all tokens with this symbol and match by position/index
                      if (!token) {
                        const matchingTokens = tokens.filter((t) => t.symbol === highestMarket.asset);
                        if (matchingTokens.length === 1) {
                          token = matchingTokens[0];
                          poolId = token.poolId;
                        } else if (matchingTokens.length > 1) {
                          // Find token matching the highest market's poolId
                          const marketPoolId = highestMarket.marketInfo?.poolId || highestMarket.poolId;
                          token = matchingTokens.find(t => t.poolId === marketPoolId) || matchingTokens[0];
                          poolId = token.poolId;
                        }
                      }
                      
                      // Final fallback: find any token with matching symbol
                      if (!token) {
                        token = tokens.find((t) => t.symbol === highestMarket.asset);
                        poolId = token?.poolId;
                      }
                      
                      const originalSymbol =
                        token && "originalSymbol" in token
                          ? (token as any).originalSymbol
                          : highestMarket.asset;
                      const tokenConfigRaw = getTokenConfig(
                        currentNetwork,
                        originalSymbol
                      );
                      const tokenConfig = Array.isArray(tokenConfigRaw)
                        ? tokenConfigRaw.find((tc) => tc.poolId === token?.poolId) || tokenConfigRaw[0]
                        : tokenConfigRaw;
                      const hasMigration = !!tokenConfig?.migration;
                      const migrationBalance = migrationBalances[highestMarket.asset];

                      // Use poolId from market object (most reliable - set when market data is loaded)
                      const finalPoolId = highestMarket.poolId || token?.poolId || poolId || highestMarket.marketInfo?.poolId;
                      
                      return (
                        <MarketsTableActions
                          asset={highestMarket.asset}
                          poolId={finalPoolId}
                          onDepositClick={onDepositClick}
                          onBorrowClick={onBorrowClick}
                          onMintClick={onMintClick}
                          onMigrateClick={
                            onMigrateClick &&
                            hasMigration &&
                            migrationBalance
                              ? onMigrateClick
                              : undefined
                          }
                          migrationBalance={migrationBalance || undefined}
                          isLoadingBalance={isLoadingBalance}
                          isSToken={highestMarket.isSToken}
                        />
                      );
                    })()}
                  </TableCell>
                </TableRow>
                  {/* Nested rows when expanded */}
                  {isExpanded &&
                    symbolMarkets.map((market, index) =>
                      renderMarketRow(market, true, `${symbol}-${index}`, index)
                    )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default MarketsDesktopTable;

