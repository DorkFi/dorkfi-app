
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
  const netValue = totalCollateral - totalBorrowed;

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/40 sm:grid-cols-2">
      <div className="bg-muted/20 p-4 dark:bg-muted/10 sm:p-5">
        <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Total Collateral
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help" />
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

      <div className="bg-muted/20 p-4 dark:bg-muted/10 sm:p-5">
        <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          Total Borrowed
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help" />
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

      <div className="bg-muted/20 p-4 dark:bg-muted/10 sm:p-5">
        <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-cyan-500" />
          Liquidation buffer
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help" />
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

      <div className="bg-muted/20 p-4 dark:bg-muted/10 sm:p-5">
        <div className="mb-2 text-sm text-muted-foreground">
          Net Portfolio Value
        </div>
        <div
          className={`text-2xl font-bold ${
            netValue >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          $
          {netValue.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        {totalCollateral > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">
            {((netValue / totalCollateral) * 100).toFixed(1)}% of collateral
            value
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionStatsGrid;
