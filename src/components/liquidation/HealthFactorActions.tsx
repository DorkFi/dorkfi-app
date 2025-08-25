
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HealthFactorActionsProps {
  healthFactor: number;
  onAddCollateral: () => void;
  onBuyVoi: () => void;
}

const HealthFactorActions = ({
  healthFactor,
  onAddCollateral,
  onBuyVoi
}: HealthFactorActionsProps) => {
  return (
    <>
      {/* Action Buttons with Tooltips */}
      <div className="space-y-3 pt-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={onAddCollateral}
              className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white font-semibold py-3"
            >
              Add Collateral
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Deposit more assets to increase your collateral, improve your health factor, and gain more borrowing capacity. Recommended when health factor is low.</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              onClick={onBuyVoi}
              variant="outline"
              className="w-full border-whale-gold text-whale-gold hover:bg-whale-gold hover:text-black font-semibold py-3"
            >
              Buy VOI
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>Purchase VOI tokens to use as collateral or to repay VOI-denominated debt. Helps strengthen your position in the Voi ecosystem.</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Risk Warning */}
      {healthFactor <= 1.2 && (
        <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-red-400 font-medium">
              {healthFactor <= 1 ? "Liquidation Risk - Act Now!" : "Monitor Position Closely"}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default HealthFactorActions;
