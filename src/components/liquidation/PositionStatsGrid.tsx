
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { getHealthFactorColorClass } from "@/utils/colorUtils";

interface PositionStatsGridProps {
  totalCollateral: number;
  totalBorrowed: number;
  liquidationMargin: number;
  netLTV: number;
  healthFactor: number | null;
}

const PositionStatsGrid = ({
  totalCollateral,
  totalBorrowed,
  liquidationMargin,
  netLTV,
  healthFactor
}: PositionStatsGridProps) => {
  // Get color classes based on health factor
  const healthFactorColorClass = healthFactor !== null ? getHealthFactorColorClass(healthFactor) : 'text-gray-500';
  
  // For liquidation margin: higher is better, so we invert the logic
  const liquidationMarginColorClass = healthFactor === null ? 'text-gray-500' :
                                     healthFactor <= 1.05 ? 'text-red-500' : 
                                     healthFactor <= 1.2 ? 'text-orange-500' : 
                                     healthFactor <= 1.5 ? 'text-yellow-500' : 'text-green-500';
  
  // For Net LTV: lower is better, so high LTV = bad (red), low LTV = good (green)
  const ltvColorClass = netLTV >= 80 ? 'text-red-500' : 
                       netLTV >= 70 ? 'text-orange-500' : 
                       netLTV >= 60 ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="space-y-4">
      {/* Primary Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-700/30 hover:shadow-lg transition-all duration-300">
          <div className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
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
          <div className={`text-2xl font-bold text-green-600 dark:text-green-400`}>
            ${totalCollateral.toLocaleString()}
          </div>
        </div>
        
        <div className="p-5 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200/50 dark:border-red-700/30 hover:shadow-lg transition-all duration-300">
          <div className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
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
          <div className={`text-2xl font-bold text-red-600 dark:text-red-400`}>
            ${totalBorrowed.toLocaleString()}
          </div>
        </div>
      </div>
      
      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200/50 dark:border-blue-700/30 hover:shadow-md transition-all duration-300">
          <div className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
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
          <div className={`text-xl font-bold ${liquidationMarginColorClass}`}>
            {liquidationMargin.toFixed(1)}%
          </div>
        </div>
        
        <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border border-purple-200/50 dark:border-purple-700/30 hover:shadow-md transition-all duration-300">
          <div className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
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
          <div className={`text-xl font-bold ${ltvColorClass}`}>
            {netLTV.toFixed(1)}%
          </div>
        </div>
      </div>
      
      {/* Net Worth Summary */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-slate-700 border border-slate-200/50 dark:border-slate-600/30">
        <div className="text-sm text-muted-foreground mb-1">Net Portfolio Value</div>
        <div className={`text-2xl font-bold ${(totalCollateral - totalBorrowed) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          ${(totalCollateral - totalBorrowed).toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {((totalCollateral - totalBorrowed) / totalCollateral * 100).toFixed(1)}% of collateral value
        </div>
      </div>
    </div>
  );
};

export default PositionStatsGrid;
