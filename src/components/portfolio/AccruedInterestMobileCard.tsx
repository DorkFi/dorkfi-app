import { Button } from "@/components/ui/button";
import { RefreshCw, Info, ArrowDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import DorkFiCard from "@/components/ui/DorkFiCard";

interface AccruedInterestMobileCardProps {
  asset: string;
  icon: string;
  netInterest: number;
  netInterestValue: number;
  earnedInterest?: number;
  owedInterest?: number;
  earnedInterestValue?: number;
  owedInterestValue?: number;
  tokenPrice?: number;
  network?: string;
  poolId?: string;
  onRepayClick?: () => void;
  onRefreshClick?: () => void;
  isRefreshing?: boolean;
}

const AccruedInterestMobileCard = ({
  asset,
  icon,
  netInterest,
  netInterestValue,
  earnedInterest,
  owedInterest,
  earnedInterestValue,
  owedInterestValue,
  tokenPrice = 1,
  network,
  poolId,
  onRepayClick,
  onRefreshClick,
  isRefreshing,
}: AccruedInterestMobileCardProps) => {
  const isNetPositive = netInterest > 0;
  const hasDeposits = (earnedInterest || 0) > 0;
  const hasBorrows = (owedInterest || 0) > 0;

  return (
    <DorkFiCard className={`p-4 border ${
      isNetPositive 
        ? "bg-green-500/5 border-green-500/10" 
        : "bg-red-500/5 border-red-500/10"
    }`}>
      <div className="space-y-3">
        {/* Header: Asset Icon + Name + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={icon}
              alt={asset}
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
            <div>
              <div className="font-semibold text-base text-slate-800 dark:text-white">
                {asset}
              </div>
              {network && (
                <div className="text-xs text-muted-foreground">
                  {network.split("-")[0].charAt(0).toUpperCase() +
                    network.split("-")[0].slice(1)}
                </div>
              )}
            </div>
          </div>
          {onRefreshClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefreshClick}
              disabled={isRefreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          )}
        </div>

        {/* Net Interest Value */}
        <div>
          <div className="text-xs text-muted-foreground mb-1">Net Accrued Interest</div>
          <div className={`text-lg font-bold ${
            isNetPositive 
              ? "text-green-400" 
              : "text-red-400"
          }`}>
            {isNetPositive ? "+" : ""}${netInterestValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className={`text-sm font-medium mt-1 ${
            isNetPositive 
              ? "text-green-600 dark:text-green-400" 
              : "text-red-600 dark:text-red-400"
          }`}>
            {isNetPositive ? "+" : ""}{netInterest.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}{" "}
            {asset}
          </div>
        </div>

        {/* Breakdown: Earned vs Owed */}
        {(hasDeposits || hasBorrows) && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            {hasDeposits && (
              <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">
                  Interest Earned
                </div>
                <div className="text-sm font-medium text-green-700 dark:text-green-300">
                  +{earnedInterest!.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}{" "}
                  {asset}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ${(earnedInterestValue || ((earnedInterest || 0) * tokenPrice)).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            )}
            {hasBorrows && (
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">
                  Interest Owed
                </div>
                <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {owedInterest!.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}{" "}
                  {asset}
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ${(owedInterestValue || ((owedInterest || 0) * tokenPrice)).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {hasBorrows && onRepayClick && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onRepayClick}
              className="flex-1"
            >
              <ArrowDown className="w-4 h-4 mr-1" />
              Repay
            </Button>
          )}
        </div>
      </div>
    </DorkFiCard>
  );
};

export default AccruedInterestMobileCard;

