
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp, Info, RefreshCw } from "lucide-react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";

interface Borrow {
  asset: string;
  icon: string;
  balance: number;
  value: number;
  apy: number;
  tokenPrice: number;
}

interface BorrowsListProps {
  borrows: Borrow[];
  onBorrowClick: (asset: string) => void;
  onRepayClick: (asset: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const BorrowsList = ({ borrows, onBorrowClick, onRepayClick, onRefresh, isLoading }: BorrowsListProps) => {
  return (
    <DorkFiCard className="card-hover dorkfi-mb-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 dorkfi-text-primary text-lg font-bold">
          <ArrowUp className="w-5 h-5 text-red-400" /> Your Borrows
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh borrows data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>
      <div className="space-y-4">
        {borrows.filter(borrow => borrow.balance > 0).map((borrow) => (
          <div
            key={borrow.asset}
            className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-center min-h-[100px] p-4 rounded-lg bg-red-500/5 border border-red-500/10 transition-all hover:bg-ocean-teal/5 hover:scale-105 hover:border-ocean-teal/40 card-hover cursor-pointer gap-y-1"
          >
            {/* Icon + Asset (left column) */}
            <div className="flex flex-col items-center gap-1 w-20">
              <img
                src={borrow.icon}
                alt={borrow.asset}
                className="w-12 h-12 md:w-10 md:h-10 rounded-full"
              />
              <div className="font-bold text-base text-slate-800 dark:text-white text-center truncate w-full">{borrow.asset}</div>
            </div>
            {/* $ value, APY, tokens and price (middle column) */}
            <div className="flex flex-col items-center gap-[2px] min-w-0 text-center">
              {/* $ value (top, red) */}
              <div className="font-semibold text-red-400 text-lg mb-1 text-center">${borrow.value.toLocaleString()}</div>
              {/* APY below $value */}
              <div className="flex items-center text-base font-semibold text-red-400 mb-1 text-center justify-center">
                {borrow.apy.toFixed(2)}% APY
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 cursor-help flex-shrink-0 ml-1" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Annual interest rate on your {borrow.asset} debt. This cost compounds over time, so consider repaying early to minimize interest payments.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1 text-center justify-center">
                {borrow.balance.toLocaleString()} tokens
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>The amount of {borrow.asset} you have borrowed. This debt accrues interest over time and must be repaid to maintain your position.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xs text-slate-500 dark:text-muted-foreground flex items-center gap-1 text-center justify-center">
                ${borrow.tokenPrice.toFixed(3)} per token
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Current market price of {borrow.asset}. If the price rises, your debt value increases, potentially affecting your health factor.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            {/* Action buttons vertical stack (right column) */}
            <div className="flex flex-col items-end gap-2 min-w-[140px] pr-3">
              <DorkFiButton
                variant={borrow.asset === "WAD" ? "mint" : "borrow-outline"}
                onClick={() => onBorrowClick(borrow.asset)}
                className="w-full max-w-[135px]"
              >{borrow.asset === "WAD" ? "Mint" : "Borrow"}</DorkFiButton>
              <DorkFiButton
                variant="danger-outline"
                onClick={() => onRepayClick(borrow.asset)}
                className="w-full max-w-[135px]"
              >Repay</DorkFiButton>
            </div>
          </div>
        ))}
        {borrows.length === 0 && (
          <div className="text-center py-8 dorkfi-text-secondary">
            <p>No active borrows</p>
          </div>
        )}
      </div>
    </DorkFiCard>
  );
};

export default BorrowsList;
