import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import MarketsTableActions from "./MarketsTableActions";
import APYDisplay from "@/components/APYDisplay";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";
import { useNetwork } from "@/contexts/NetworkContext";
import { getMarketLabel } from "@/config";
import {
  borrowApyBadgeClassName,
  BORROW_APY_BADGE_STOKEN,
} from "@/constants/marketUi";
import { isAtBorrowCap } from "@/constants/lendingCaps";
import { MarketRowTokenIcon } from "./MarketRowTokenIcon";

interface STokenTabletRowProps {
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
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
    <span className="text-sm">Loading...</span>
  </div>
);

const ErrorCell = ({ error }: { error: string }) => (
  <div className="flex items-center justify-center text-red-500 text-sm">
    Error: {error}
  </div>
);

const STokenTabletRow = ({
  market,
  onRowClick,
  onInfoClick,
  onDepositClick,
  onBorrowClick,
  onMintClick,
  isLoadingBalance = false,
  isNested = false,
  marketIndex,
}: STokenTabletRowProps) => {
  const { currentNetwork } = useNetwork();
  const borrowCapReached = isAtBorrowCap(
    Number(market.totalBorrow ?? 0),
    Number(market.borrowCap ?? 0)
  );

  return (
    <TableRow
      key={market.asset}
      className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 cursor-pointer transition-all duration-300 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/30 to-pink-50/30 dark:from-purple-900/10 dark:to-pink-900/10"
      onClick={() => onRowClick(market)}
    >
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <MarketRowTokenIcon
            market={market}
            poolLetterLabel={(() => {
              const poolId = market.marketInfo?.poolId || market.poolId;
              return poolId ? getMarketLabel(currentNetwork, poolId) : null;
            })()}
          />
          <div className="flex flex-col items-start gap-0.5 whitespace-nowrap">
            <span className="font-semibold text-sm leading-tight">{market.asset}</span>
            <Badge variant="outline" className="text-xs px-2.5 py-0.5 h-5 flex items-center justify-center whitespace-nowrap min-w-fit">CF {Math.round(market.collateralFactor)}%</Badge>
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
          <Badge
            className={borrowApyBadgeClassName(
              market.intrinsicBorrowApyPercent,
              BORROW_APY_BADGE_STOKEN
            )}
          >
            <BorrowAPYDisplay 
              apyCalculation={market.apyCalculation}
              borrowApyCalculation={market.borrowApyCalculation}
              fallbackAPY={market.borrowAPY}
              intrinsicBorrowApyPercent={market.intrinsicBorrowApyPercent}
              showTooltip={true}
              networkId={currentNetwork}
              asset={market.asset}
              poolId={market.marketInfo?.poolId ?? market.poolId}
              market={market}
              marketIndex={marketIndex}
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
                className="h-2 w-16 [&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-pink-500" 
              />
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">
        <MarketsTableActions
          asset={market.asset}
          onDepositClick={onDepositClick}
          onBorrowClick={onBorrowClick}
          onMintClick={onMintClick}
          isLoadingBalance={isLoadingBalance}
          isSToken={true}
          borrowDisabled={borrowCapReached}
        />
      </TableCell>
    </TableRow>
  );
};

export default STokenTabletRow;
