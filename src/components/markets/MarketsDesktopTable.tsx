
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
import { Info, Loader2 } from "lucide-react";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import MarketsTableActions from "./MarketsTableActions";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import APYDisplay from "@/components/APYDisplay";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";
import STokenRow from "./STokenRow";
import { useState, useEffect } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@txnlab/use-wallet-react";
import { getTokenConfig, getAllTokensWithDisplayInfo } from "@/config";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";

interface MarketsDesktopTableProps {
  markets: OnDemandMarketData[];
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
  onMintClick?: (asset: string) => void;
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
          const tokenConfig = getTokenConfig(currentNetwork, originalSymbol);

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
            {markets.map((market) => {
              // Render special row for s-tokens
              if (market.isSToken) {
                return (
                  <STokenRow
                    key={market.asset}
                    market={market}
                    onRowClick={onRowClick}
                    onInfoClick={onInfoClick}
                    onDepositClick={onDepositClick}
                    onBorrowClick={onBorrowClick}
                    onMintClick={onMintClick}
                    isLoadingBalance={isLoadingBalance}
                  />
                );
              }

              // Render regular row for non-s-tokens
              return (
                <TableRow
                  key={market.asset}
                  className="transition-all relative card-hover rounded-lg border border-gray-200/30 dark:border-ocean-teal/10 bg-white/50 dark:bg-slate-800/50 hover:border-teal-400 hover:shadow-[0_0_16px_4px_rgba(13,255,190,0.15)] hover:z-20 cursor-pointer"
                  onClick={() => onRowClick(market)}
                >
                  <TableCell className="text-left align-top">
                    <div className="flex items-center gap-3 w-full">
                      {/* Asset icon */}
                      <img
                        src={market.icon}
                        alt={market.asset}
                        className="w-10 h-10 rounded-full object-contain flex-shrink-0"
                      />
                      {/* Asset name and CF badge stacked */}
                      <div className="flex flex-col items-center">
                        <div className="font-extrabold text-lg leading-tight">{market.asset}</div>
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4 mt-1 text-muted-foreground">CF {market.collateralFactor}%</Badge>
                      </div>
                      {/* Removed info icon */}
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
                      const token = tokens.find((t) => t.symbol === market.asset);
                      const originalSymbol =
                        token && "originalSymbol" in token
                          ? (token as any).originalSymbol
                          : market.asset;
                      const tokenConfig = getTokenConfig(
                        currentNetwork,
                        originalSymbol
                      );
                      const hasMigration = !!tokenConfig?.migration;
                      const migrationBalance = migrationBalances[market.asset];

                      return (
                        <MarketsTableActions
                          asset={market.asset}
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
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default MarketsDesktopTable;

