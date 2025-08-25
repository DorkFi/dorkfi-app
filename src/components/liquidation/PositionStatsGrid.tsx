
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { getHealthFactorColorClass } from "@/utils/colorUtils";

interface PositionStatsGridProps {
  totalCollateral: number;
  totalBorrowed: number;
  liquidationMargin: number;
  netLTV: number;
  healthFactor: number;
}

const PositionStatsGrid = ({
  totalCollateral,
  totalBorrowed,
  liquidationMargin,
  netLTV,
  healthFactor
}: PositionStatsGridProps) => {
  // Get color classes based on health factor
  const healthFactorColorClass = getHealthFactorColorClass(healthFactor);
  
  // For liquidation margin: higher is better, so we invert the logic
  const liquidationMarginColorClass = healthFactor <= 1.05 ? 'text-red-500' : 
                                     healthFactor <= 1.2 ? 'text-orange-500' : 
                                     healthFactor <= 1.5 ? 'text-yellow-500' : 'text-green-500';
  
  // For Net LTV: lower is better, so high LTV = bad (red), low LTV = good (green)
  const ltvColorClass = netLTV >= 80 ? 'text-red-500' : 
                       netLTV >= 70 ? 'text-orange-500' : 
                       netLTV >= 60 ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="p-4 rounded-lg bg-ocean-teal/10 border border-ocean-teal/20">
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          Total Collateral
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>The total USD value of all your deposited assets that can be used as collateral for borrowing. Higher collateral increases your borrowing capacity.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className={`text-2xl font-bold ${healthFactorColorClass} text-center`}>
          ${totalCollateral.toLocaleString()}
        </div>
      </div>
      
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          Total Borrowed
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>The total USD value of all your outstanding debt. This amount accrues interest over time and must be repaid to maintain a healthy position.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className={`text-2xl font-bold ${healthFactorColorClass} text-center`}>
          ${totalBorrowed.toLocaleString()}
        </div>
      </div>
      
      <div className="p-4 rounded-lg bg-ocean-teal/10 border border-ocean-teal/20">
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          Liquidation Margin
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>The safety buffer between your current position and liquidation. A higher margin means more protection against market volatility and price drops.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className={`text-xl font-bold ${liquidationMarginColorClass} text-center`}>
          {liquidationMargin.toFixed(1)}%
        </div>
      </div>
      
      <div className="p-4 rounded-lg bg-ocean-teal/10 border border-ocean-teal/20">
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          Net LTV
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Loan-to-Value ratio shows how much you've borrowed relative to your collateral. Lower LTV = safer position. Most protocols liquidate around 80-85% LTV.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className={`text-xl font-bold ${ltvColorClass} text-center`}>
          {netLTV.toFixed(1)}%
        </div>
      </div>
    </div>
  );
};

export default PositionStatsGrid;
