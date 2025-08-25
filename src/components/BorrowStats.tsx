
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
          <span className="text-sm font-medium text-teal-600 dark:text-teal-400">{marketStats.liquidationMargin}%</span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Health Factor</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Position health indicator</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium text-whale-gold">{marketStats.healthFactor}</span>
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
          <span className="text-sm font-medium text-slate-800 dark:text-white">{marketStats.currentLTV}%</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default BorrowStats;
