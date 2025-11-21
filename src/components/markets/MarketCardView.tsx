
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Info } from "lucide-react";
import { OnDemandMarketData } from "@/hooks/useOnDemandMarketData";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import APYDisplay from "@/components/APYDisplay";
import BorrowAPYDisplay from "@/components/BorrowAPYDisplay";
import { useNetwork } from "@/contexts/NetworkContext";
import STokenCard from "./STokenCard";

interface MarketCardViewProps {
  markets: OnDemandMarketData[];
  onRowClick: (market: OnDemandMarketData) => void;
  onInfoClick: (e: React.MouseEvent, market: OnDemandMarketData) => void;
  onDepositClick: (asset: string) => void;
  onBorrowClick: (asset: string) => void;
  onMintClick?: (asset: string) => void;
}

const MarketCardView = ({ 
  markets, 
  onRowClick, 
  onInfoClick, 
  onDepositClick, 
  onBorrowClick,
  onMintClick
}: MarketCardViewProps) => {
  const { currentNetwork } = useNetwork();
  if (markets.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-ink-blue">No markets found matching your search criteria.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {markets.map((market) => {
        // Render special card for s-tokens
        if (market.isSToken) {
          return (
            <STokenCard
              key={market.asset}
              market={market}
              onRowClick={onRowClick}
              onInfoClick={onInfoClick}
              onDepositClick={onDepositClick}
              onBorrowClick={onBorrowClick}
              onMintClick={onMintClick}
            />
          );
        }

        // Render regular card for non-s-tokens
        return (
          <DorkFiCard
            key={market.asset}
            className="flex flex-col md:flex-row md:items-stretch gap-4 md:gap-6"
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
            <div className="grid grid-cols-2 gap-4 sm:gap-2 md:grid-cols-2 text-center">
              <div className="flex flex-col items-center md:items-start">
                <div className="text-sm text-muted-foreground mb-1">Deposit APY</div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <APYDisplay 
                    apyCalculation={market.apyCalculation}
                    fallbackAPY={market.supplyAPY}
                    showTooltip={true}
                  />
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  ${(market.totalSupplyUSD / 1_000_000).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-col items-center md:items-start">
                <div className="text-sm text-muted-foreground mb-1">Borrow APY</div>
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  <BorrowAPYDisplay 
                    apyCalculation={market.apyCalculation}
                    borrowApyCalculation={market.borrowApyCalculation}
                    fallbackAPY={market.borrowAPY}
                    showTooltip={true}
                  />
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  ${(market.totalBorrowUSD / 1_000_000).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center md:justify-between mb-2">
                <span className="text-sm text-muted-foreground">Utilization</span>
                <span className="text-sm font-medium ml-2 md:ml-0">{market.utilization.toFixed(2)}%</span>
              </div>
              <div className="flex justify-center md:justify-start">
                <Progress value={market.utilization} className="h-2 w-full max-w-[200px] md:max-w-none" />
              </div>
            </div>

            <div className="flex gap-2 pt-1 justify-center md:justify-start">
              <DorkFiButton
                variant="secondary"
                onClick={e => { e.stopPropagation(); onDepositClick(market.asset); }}
              >Deposit</DorkFiButton>
              <DorkFiButton
                variant="borrow-outline"
                onClick={e => { e.stopPropagation(); onBorrowClick(market.asset); }}
              >Borrow</DorkFiButton>
            </div>
          </DorkFiCard>
        );
      })}
    </div>
  );
};

export default MarketCardView;
