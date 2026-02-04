import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Info } from "lucide-react";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import MarketsTableActions from "./MarketsTableActions";
import APYDisplay from "@/components/APYDisplay";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";
import { useNetwork } from "@/contexts/NetworkContext";
import { getNetworkConfig } from "@/config";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";

interface STokenRowProps {
  market: OnDemandMarketData;
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
  onMintClick?: (asset: string, poolId?: string) => void;
  isLoadingBalance?: boolean;
  isNested?: boolean;
  marketIndex?: number;
}

const LoadingCell = () => (
  <div className="flex items-center justify-center gap-2 text-muted-foreground">
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ocean-teal"></div>
    <span className="text-sm">Loading...</span>
  </div>
);

const ErrorCell = ({ error }: { error: string }) => (
  <div className="flex items-center justify-center text-red-500 text-sm">
    Error: {error}
  </div>
);

const STokenRow = ({
  market,
  onRowClick,
  onInfoClick,
  onDepositClick,
  onBorrowClick,
  onMintClick,
  isLoadingBalance = false,
  isNested = false,
  marketIndex,
}: STokenRowProps) => {
  const { formatNumber, formatCurrency } = useNumberI18n();
  const { currentNetwork } = useNetwork();

  return (
    <TableRow
      key={market.asset}
      className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 cursor-pointer transition-all duration-300 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/30 to-pink-50/30 dark:from-purple-900/10 dark:to-pink-900/10"
      onClick={() => onRowClick(market)}
    >
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="relative flex-shrink-0">
            <img
              src={market.icon}
              alt={market.asset}
              className="w-10 h-10 rounded-full object-contain flex-shrink-0" // Updated size to match MarketsDesktopTable
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
              const lendingPools = networkConfig?.contracts?.lendingPools || [];
              
              let marketLabel: string | null = null;
              const poolId = market.marketInfo?.poolId || market.poolId;
              
              if (poolId && lendingPools.length >= 2) {
                if (String(poolId) === String(lendingPools[0])) {
                  marketLabel = "A";
                } else if (String(poolId) === String(lendingPools[1])) {
                  marketLabel = "B";
                }
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
          <div className="flex flex-col items-center justify-center gap-1 text-center whitespace-nowrap">
            <div className="font-extrabold text-lg leading-tight">{market.asset}</div>
            <Badge variant="outline" className="text-xs px-2.5 py-0.5 h-5 mt-1 text-muted-foreground flex items-center justify-center whitespace-nowrap min-w-fit">CF {Math.round(market.collateralFactor)}%</Badge>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        {market.isLoading ? (
          <LoadingCell />
        ) : market.error ? (
          <ErrorCell error={market.error} />
        ) : (
          <div className="text-muted-foreground text-sm">
            
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">
        {market.isLoading ? (
          <LoadingCell />
        ) : market.error ? (
          <ErrorCell error={market.error} />
        ) : (
          <div className="text-muted-foreground text-sm">
            
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">
        {market.isLoading ? (
          <LoadingCell />
        ) : market.error ? (
          <ErrorCell error={market.error} />
        ) : (
          <div>
            <div className="font-medium text-purple-700 dark:text-purple-300">
              {formatCurrency(Math.round(market.totalBorrowUSD / 1_000_000), "USD", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatNumber(market.totalBorrow, { maximumFractionDigits: 3 })} {market.asset}
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
          <Badge className="bg-gradient-to-r from-red-100 to-pink-100 text-red-800 dark:from-red-900 dark:to-pink-900 dark:text-red-200 border border-red-300 dark:border-red-600">
            <BorrowAPYDisplay 
              apyCalculation={market.apyCalculation}
              borrowApyCalculation={market.borrowApyCalculation}
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
            <div className="text-sm font-medium text-purple-700 dark:text-purple-300">
              100.0%
            </div>
            <div className="flex justify-center w-full">
              <Progress 
                value={100} 
                className="h-2 w-20 [&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-pink-500" 
              />
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">
        <MarketsTableActions
          asset={market.asset}
          poolId={market.marketInfo?.poolId}
          onDepositClick={onDepositClick}
          onBorrowClick={onBorrowClick}
          onMintClick={onMintClick}
          isLoadingBalance={isLoadingBalance}
          isSToken={true}
        />
      </TableCell>
    </TableRow>
  );
};

export default STokenRow;
