/**
 * APY Display Component
 *
 * This component displays APY with tooltips showing the calculation breakdown
 */

import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { APYCalculationResult, formatAPY, getAPYColorClass } from "@/utils/apyCalculations";

interface APYDisplayProps {
  apyCalculation?: APYCalculationResult;
  fallbackAPY?: number;
  /** Intrinsic supply APY from token config (% points); added to displayed APY. */
  intrinsicApyPercent?: number | null;
  /** Extra supply APR from bonus rewards program (% points); added to displayed APY. */
  bonusRewardsAprPercent?: number | null;
  /** Use black/gold-friendly text (pair with rewards deposit badge). */
  hasRewardsProgram?: boolean;
  /** Use dark text for silver intrinsic deposit badge (pair with `DEPOSIT_APY_BADGE_INTRINSIC`). */
  hasIntrinsicApy?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export const APYDisplay: React.FC<APYDisplayProps> = ({
  apyCalculation,
  fallbackAPY = 0,
  intrinsicApyPercent,
  bonusRewardsAprPercent,
  hasRewardsProgram = false,
  hasIntrinsicApy = false,
  showTooltip = true,
  className = "",
}) => {
  const baseApy = apyCalculation?.apy ?? fallbackAPY;
  const intrinsic =
    typeof intrinsicApyPercent === "number" &&
    Number.isFinite(intrinsicApyPercent)
      ? intrinsicApyPercent
      : 0;
  const bonus =
    typeof bonusRewardsAprPercent === "number" &&
    Number.isFinite(bonusRewardsAprPercent)
      ? bonusRewardsAprPercent
      : 0;
  const apy = baseApy + intrinsic + bonus;
  const formattedAPY = formatAPY(apy);
  const colorClass = hasRewardsProgram
    ? "text-black"
    : hasIntrinsicApy
      ? "text-black"
      : getAPYColorClass(apy);
  const infoIconClass = hasRewardsProgram
    ? "h-3 w-3 text-black/55"
    : hasIntrinsicApy
      ? "h-3 w-3 text-black/55"
      : "h-3 w-3 text-gray-400 hover:text-gray-600";

  if (!showTooltip || (!apyCalculation && bonus <= 0 && intrinsic <= 0)) {
    return (
      <span className={`font-medium ${colorClass} ${className}`}>
        {formattedAPY}
      </span>
    );
  }

  const tooltipContent = (
    <div className="space-y-2 text-sm">
      <div className="font-semibold text-white mb-2">APY Calculation Breakdown</div>

      <div className="space-y-1">
        {apyCalculation ? (
          <>
            <div className="flex justify-between">
              <span className="text-gray-300">Utilization Rate:</span>
              <span className="text-white font-mono">
                {(apyCalculation.utilizationRate * 100).toFixed(2)}%
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-300">Borrow Rate:</span>
              <span className="text-white font-mono">
                {(apyCalculation.borrowRate * 100).toFixed(2)}%
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-300">Supply Rate:</span>
              <span className="text-white font-mono">
                {(apyCalculation.supplyRate * 100).toFixed(2)}%
              </span>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <span className="text-gray-300">Supply APY (protocol):</span>
            <span className="text-white font-mono">{formatAPY(baseApy)}</span>
          </div>
        )}

        {intrinsic > 0 ? (
          <div className="flex justify-between">
            <span className="text-gray-300">Intrinsic APY:</span>
            <span className="text-sky-300 font-mono">+{formatAPY(intrinsic)}</span>
          </div>
        ) : null}

        {bonus > 0 ? (
          <div className="flex justify-between">
            <span className="text-gray-300">Bonus rewards:</span>
            <span className="text-emerald-300 font-mono">+{formatAPY(bonus)}</span>
          </div>
        ) : null}

        <div className="border-t border-gray-600 pt-1 mt-2">
          <div className="flex justify-between font-semibold">
            <span className="text-white">Total deposit APY:</span>
            <span className="text-green-400 font-mono">{formattedAPY}</span>
          </div>
        </div>
      </div>

      {apyCalculation ? (
        <div className="text-xs text-gray-400 mt-2">
          APY = (1 + daily_supply_rate)^365 - 1
        </div>
      ) : null}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <span className={`font-medium ${colorClass} ${className}`}>
              {formattedAPY}
            </span>
            <Info className={infoIconClass} />
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs bg-gray-900 border-gray-700 text-white p-3"
        >
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default APYDisplay;
