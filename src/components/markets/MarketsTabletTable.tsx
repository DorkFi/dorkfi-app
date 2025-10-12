
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info } from "lucide-react";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import MarketsTableActions from "./MarketsTableActions";
import { Button } from "@/components/ui/button";
import APYDisplay from "@/components/APYDisplay";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";

interface MarketsTabletTableProps {
  markets: OnDemandMarketData[];
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
}

const MarketsTabletTable = ({
  markets,
  onRowClick,
  onInfoClick,
  onDepositClick,
  onBorrowClick,
}: MarketsTabletTableProps) => {
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">Asset</TableHead>
            <TableHead className="text-center">Deposit APY</TableHead>
            <TableHead className="text-center">Borrow APY</TableHead>
            <TableHead className="text-center">Util</TableHead>
            <TableHead className="text-center">Actions</TableHead>
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
                <div className="flex items-center justify-center gap-2">
                  <img
                    src={market.icon}
                    alt={market.asset}
                    className="w-6 h-6 rounded-full flex-shrink-0"
                  />
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-semibold text-sm leading-tight">{market.asset}</span>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4">CF {market.collateralFactor}%</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onInfoClick(e, market); }}
                    className="p-1 h-auto"
                  >
                    <Info className="w-4 h-4 text-ocean-teal" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <APYDisplay 
                    apyCalculation={market.apyCalculation}
                    fallbackAPY={market.supplyAPY}
                    showTooltip={true}
                  />
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  <BorrowAPYDisplay 
                    apyCalculation={market.apyCalculation}
                    fallbackAPY={market.borrowAPY}
                    showTooltip={true}
                  />
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center space-y-1">
                  <span className="text-sm font-medium">{market.utilization.toFixed(2)}%</span>
                  <Progress value={market.utilization} className="h-2 w-16" />
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
  );
};

export default MarketsTabletTable;
