
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  formatHealthFactorBuffer,
  getHealthFactorTextColorClass,
} from "@/utils/healthFactorUx";

interface PositionStatsGridProps {
  totalCollateral: number;
  totalBorrowed: number;
  healthFactor: number | null;
}

const PositionStatsGrid = ({
  totalCollateral,
  totalBorrowed,
  healthFactor,
}: PositionStatsGridProps) => {
  const bufferText = formatHealthFactorBuffer(healthFactor);
  const hfColorClass =
    healthFactor !== null
      ? getHealthFactorTextColorClass(healthFactor)
      : "text-muted-foreground";

  return (
    <div className="space-y-4">
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
                <p>Total USD value of assets you have supplied.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            $
            {totalCollateral.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
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
                <p>Total USD value of your outstanding debt (accrues interest).</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            $
            {totalBorrowed.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="h-full p-5 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200/50 dark:border-slate-600/30 hover:shadow-lg transition-all duration-300">
          <div className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
            Liquidation buffer
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  How far your health factor is above liquidation (HF = 1.0).
                  Higher buffer means more room before actions are blocked.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={`text-2xl font-bold ${hfColorClass}`}>{bufferText}</div>
        </div>

        <div className="h-full p-5 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-slate-700 border border-slate-200/50 dark:border-slate-600/30 hover:shadow-lg transition-all duration-300">
          <div className="text-sm text-muted-foreground mb-2">
            Net Portfolio Value
          </div>
          <div
            className={`text-2xl font-bold ${
              totalCollateral - totalBorrowed >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            $
            {(totalCollateral - totalBorrowed).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          {totalCollateral > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {(
                ((totalCollateral - totalBorrowed) / totalCollateral) *
                100
              ).toFixed(1)}
              % of collateral value
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PositionStatsGrid;
