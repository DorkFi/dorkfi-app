
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

interface MarketsDesktopTableProps {
  markets: OnDemandMarketData[];
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
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

const LoadingCell = ({ children }: { children: React.ReactNode }) => (
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
  isLoadingBalance = false,
}: MarketsDesktopTableProps) => {
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
    <div className="overflow-x-auto">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
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
            {markets.map((market) => (
              <TableRow
                key={market.asset}
                className="hover:bg-ocean-teal/5 cursor-pointer transition-colors"
                onClick={() => onRowClick(market)}
              >
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-3">
                    <img
                      src={market.icon}
                      alt={market.asset}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                    <div className="flex flex-col items-center justify-center gap-1 text-center">
                      <div className="font-semibold text-base leading-tight">
                        {market.asset}
                      </div>
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                        CF {market.collateralFactor}%
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => onInfoClick(e, market)}
                      className="p-1 h-auto"
                    >
                      <Info className="w-4 h-4 text-ocean-teal" />
                    </Button>
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
                        ${market.totalSupplyUSD.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {market.totalSupply.toLocaleString()} {market.asset}
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
                      {market.supplyAPY.toFixed(2)}%
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
                        ${market.totalBorrowUSD.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {market.totalBorrow.toLocaleString()} {market.asset}
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
                      {market.borrowAPY.toFixed(2)}%
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {market.isLoading ? (
                    <LoadingCell />
                  ) : market.error ? (
                    <ErrorCell error={market.error} />
                  ) : (
                    <div className="flex flex-col items-center space-y-1">
                      <div className="text-sm font-medium">
                        {market.utilization.toFixed(1)}%
                      </div>
                      <div className="flex justify-center w-full">
                        <Progress value={market.utilization} className="h-2 w-20" />
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <MarketsTableActions
                    asset={market.asset}
                    onDepositClick={onDepositClick}
                    onBorrowClick={onBorrowClick}
                    isLoadingBalance={isLoadingBalance}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default MarketsDesktopTable;

