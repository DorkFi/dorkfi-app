import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Info } from "lucide-react";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import APYDisplay from "@/components/APYDisplay";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";

interface STokenCardProps {
  market: OnDemandMarketData;
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
  onMintClick?: (asset: string) => void;
}

const STokenCard = ({ 
  market, 
  onRowClick, 
  onInfoClick, 
  onDepositClick, 
  onBorrowClick,
  onMintClick
}: STokenCardProps) => {
  return (
    <DorkFiCard
      key={market.asset}
      className="flex flex-col md:flex-row md:items-stretch gap-4 md:gap-6 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/30 to-pink-50/30 dark:from-purple-900/10 dark:to-pink-900/10 hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 transition-all duration-300"
      onClick={() => onRowClick(market)}
    >
      {/* Header with logo, asset info, and info button */}
      <div className="flex flex-col items-center text-center md:flex-col-reverse md:items-start md:text-left md:justify-normal">
        <div className="flex items-center gap-3 flex-1">
          <img src={market.icon} alt={market.asset} className="w-10 h-10 md:w-8 md:h-8 rounded-full object-contain flex-shrink-0" />
          <div className="flex flex-col items-center justify-center gap-1 text-center flex-1">
            <div className="font-semibold text-lg leading-tight">{market.asset}</div>
            <Badge variant="outline" className="text-xs px-1 py-0 h-4">
              CF {market.collateralFactor}%
            </Badge>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onInfoClick(e, market); }}
          className="p-1 h-auto flex-shrink-0 self-center md:self-start"
        >
          <Info className="w-4 h-4 text-ocean-teal" />
        </Button>
      </div>

      {/* APY and Supply/Borrow Info */}
      <div className="grid grid-cols-1 gap-4 sm:gap-2 md:grid-cols-1 text-center">
        <div className="flex flex-col items-center md:items-start">
          <div className="text-sm text-muted-foreground mb-1">Borrow APY</div>
          <Badge className="bg-gradient-to-r from-red-100 to-pink-100 text-red-800 dark:from-red-900 dark:to-pink-900 dark:text-red-200 border border-red-300 dark:border-red-600">
            <BorrowAPYDisplay 
              apyCalculation={market.apyCalculation}
              fallbackAPY={market.borrowAPY}
              showTooltip={true}
            />
          </Badge>
          <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
            ${(market.totalBorrowUSD / 1_000_000).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center md:justify-between mb-2">
          <span className="text-sm text-muted-foreground">Utilization</span>
          <span className="text-sm font-medium ml-2 md:ml-0 text-purple-700 dark:text-purple-300">{market.utilization.toFixed(2)}%</span>
        </div>
        <div className="flex justify-center md:justify-start">
          <Progress 
            value={market.utilization} 
            className="h-2 w-full max-w-[200px] md:max-w-none [&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-pink-500" 
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1 justify-center md:justify-start">
        <DorkFiButton
          variant="secondary"
          onClick={e => { e.stopPropagation(); onMintClick?.(market.asset); }}
          className="w-full bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900 dark:hover:bg-purple-800 dark:text-purple-200"
        >
          Mint
        </DorkFiButton>
      </div>
    </DorkFiCard>
  );
};

export default STokenCard;
