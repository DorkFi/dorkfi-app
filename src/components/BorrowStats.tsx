
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BorrowStatsProps {
  tokenSymbol: string;
  marketStats: {
    borrowAPY: number;
    liquidationMargin: number;
    healthFactor: number;
    currentLTV: number;
  };
}

const BorrowStats = ({ tokenSymbol, marketStats }: BorrowStatsProps) => {
  // Get health factor label and color based on ranges
  const getHealthFactorLabel = (healthFactor: number): { label: string; color: string } => {
    if (healthFactor >= 3.0) {
      return { label: "Safe", color: "text-green-600 dark:text-green-400" };
    } else if (healthFactor >= 1.5) {
      return { label: "Moderate", color: "text-blue-600 dark:text-blue-400" };
    } else if (healthFactor >= 1.2) {
      return { label: "Caution", color: "text-yellow-600 dark:text-yellow-400" };
    } else if (healthFactor >= 1.0) {
      return { label: "Critical", color: "text-orange-600 dark:text-orange-400" };
    } else {
      return { label: "Liquidatable", color: "text-red-600 dark:text-red-400" };
    }
  };

  const healthFactorLabel = getHealthFactorLabel(marketStats.healthFactor);

  // Debug logging for health factor calculation
  console.log("[BorrowStats] Health Factor Debug:", {
    tokenSymbol,
    healthFactor: marketStats.healthFactor,
    label: healthFactorLabel.label,
    liquidationMargin: marketStats.liquidationMargin,
    currentLTV: marketStats.currentLTV,
    borrowAPY: marketStats.borrowAPY,
    calculation: {
      formula: "Health Factor = (Total Collateral × 0.8) / Total Borrowed",
      explanation: `${healthFactorLabel.label} (${marketStats.healthFactor.toFixed(2)})`,
    },
  });

  return (
    <Card className="bg-white/80 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Borrow APY</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Annual percentage yield for borrowing {tokenSymbol}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium text-red-600 dark:text-red-400">{marketStats.borrowAPY}%</span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Liquidation Margin</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Safety margin before liquidation risk</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium text-teal-600 dark:text-teal-400">{marketStats.liquidationMargin.toFixed(2)}%</span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Health Factor</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2">
                  <p className="font-semibold">Health Factor = (Collateral × 0.8) / Borrowed</p>
                  <p className="text-xs">
                    {marketStats.healthFactor >= 3.0
                      ? `✓ Safe: ${marketStats.healthFactor.toFixed(2)} (excellent health)`
                      : marketStats.healthFactor >= 1.5
                      ? `✓ Moderate: ${marketStats.healthFactor.toFixed(2)} (good health)`
                      : marketStats.healthFactor >= 1.2
                      ? `⚠ Caution: ${marketStats.healthFactor.toFixed(2)} (monitor closely)`
                      : marketStats.healthFactor >= 1.0
                      ? `⚠ Critical: ${marketStats.healthFactor.toFixed(2)} (at liquidation threshold)`
                      : `✗ Liquidatable: ${marketStats.healthFactor.toFixed(2)} (can be liquidated)`}
                  </p>
                  <div className="text-xs text-slate-300 space-y-1">
                    <p>• Safe (≥3.0): Excellent health</p>
                    <p>• Moderate (≥1.5): Good health</p>
                    <p>• Caution (≥1.2): Monitor closely</p>
                    <p>• Critical (≥1.0): At liquidation threshold</p>
                    <p>• Liquidatable (&lt;1.0): Can be liquidated</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className={`text-sm font-medium ${healthFactorLabel.color}`}>
            {healthFactorLabel.label} ({marketStats.healthFactor.toFixed(2)})
          </span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">LTV</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Loan-to-Value ratio of your position</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium text-slate-800 dark:text-white">{marketStats.currentLTV.toFixed(2)}%</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default BorrowStats;
