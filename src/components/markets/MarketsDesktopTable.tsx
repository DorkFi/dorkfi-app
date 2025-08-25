
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
import { Info } from "lucide-react";
import { MarketData } from "@/hooks/useMarketData";
import MarketsTableActions from "./MarketsTableActions";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface MarketsDesktopTableProps {
  markets: MarketData[];
  onRowClick: (market: MarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: MarketData) => void;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
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

const MarketsDesktopTable = ({
  markets,
  onRowClick,
  onInfoClick,
  onDepositClick,
  onBorrowClick,
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
                      <Badge variant="outline" className="text-xs">
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
                  <div>
                    <div className="font-medium">
                      ${market.totalSupplyUSD.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {market.totalSupply.toLocaleString()} {market.asset}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {market.supplyAPY}%
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div>
                    <div className="font-medium">
                      ${market.totalBorrowUSD.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {market.totalBorrow.toLocaleString()} {market.asset}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    {market.borrowAPY}%
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center space-y-1">
                    <div className="text-sm font-medium">
                      {market.utilization}%
                    </div>
                    <div className="flex justify-center w-full">
                      <Progress value={market.utilization} className="h-2 w-20" />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <MarketsTableActions
                    asset={market.asset}
                    onDepositClick={onDepositClick}
                    onBorrowClick={onBorrowClick}
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

