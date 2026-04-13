
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatHealthFactorBuffer,
  getHealthFactorTextColorClass,
} from "@/utils/healthFactorUx";

interface BorrowStatsProps {
  tokenSymbol: string;
  marketStats: {
    borrowAPY: number;
    healthFactor: number;
  };
}

const BorrowStats = ({ tokenSymbol, marketStats }: BorrowStatsProps) => {
  const hfColor = getHealthFactorTextColorClass(marketStats.healthFactor);
  const bufferText = formatHealthFactorBuffer(marketStats.healthFactor);

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
                <p>Annual interest rate for borrowing {tokenSymbol}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium text-red-600 dark:text-red-400">{marketStats.borrowAPY}%</span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Health factor</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Your position must stay above HF = 1.0. Borrowing is capped so you do not go below that threshold.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className={`text-sm font-semibold tabular-nums ${hfColor}`}>
            {marketStats.healthFactor.toFixed(2)}
          </span>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="text-xs text-muted-foreground mb-0.5">Liquidation buffer</div>
          <div className={`text-sm font-medium ${hfColor}`}>{bufferText}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BorrowStats;
