
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import MarketsTableActions from "./MarketsTableActions";
import APYDisplay from "@/components/APYDisplay";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";
import STokenTabletRow from "./STokenTabletRow";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@txnlab/use-wallet-react";
import { getTokenConfig, getAllTokensWithDisplayInfo } from "@/config";
import { ARC200Service } from "@/services/arc200Service";
import algorandService from "@/services/algorandService";

interface MarketsTabletTableProps {
  markets: OnDemandMarketData[];
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
  onMintClick?: (asset: string) => void;
  onMigrateClick?: (asset: string) => void;
  isLoadingBalance?: boolean;
}

const MarketsTabletTable = ({
  markets,
  onRowClick,
  onInfoClick,
  onDepositClick,
  onBorrowClick,
  onMintClick,
  onMigrateClick,
  isLoadingBalance = false,
}: MarketsTabletTableProps) => {
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

      const balances: Record<string, boolean> = {};
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

  // Check if any market is an s-token to determine if we should hide Deposit APY column
  const hasSTokens = markets.some(market => market.isSToken);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Asset</TableHead>
            {!hasSTokens && <TableHead className="text-center">Deposit APY</TableHead>}
            <TableHead className="text-center">Borrow APY</TableHead>
            <TableHead className="text-center">Util</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {markets.map((market) => {
            // Render special row for s-tokens
            if (market.isSToken) {
              return (
                <STokenTabletRow
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
                className="hover:bg-ocean-teal/5 cursor-pointer transition-colors"
                onClick={() => onRowClick(market)}
              >
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <img
                      src={market.icon}
                      alt={market.asset}
                      className="w-10 h-10 rounded-full object-contain flex-shrink-0"
                    />
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-semibold text-sm leading-tight">{market.asset}</span>
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4">CF {market.collateralFactor}%</Badge>
                    </div>
                    {/* Removed info icon */}
                  </div>
                </TableCell>
                {!hasSTokens && (
                  <TableCell className="text-center">
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <APYDisplay 
                        apyCalculation={market.apyCalculation}
                        fallbackAPY={market.supplyAPY}
                        showTooltip={true}
                      />
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="text-center">
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    <BorrowAPYDisplay 
                      apyCalculation={market.apyCalculation}
                      borrowApyCalculation={market.borrowApyCalculation}
                      fallbackAPY={market.borrowAPY}
                      showTooltip={true}
                    />
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center space-y-1">
                    <span className="text-sm font-medium">{market.isSToken ? "100.00" : market.utilization.toFixed(2)}%</span>
                    <Progress value={market.isSToken ? 100 : market.utilization} className="h-2 w-16" />
                  </div>
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
                        onMigrateClick={
                          onMigrateClick &&
                          hasMigration &&
                          migrationBalance
                            ? onMigrateClick
                            : undefined
                        }
                        migrationBalance={migrationBalance || undefined}
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
  );
};

export default MarketsTabletTable;
