
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp, Info } from "lucide-react";
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
}

const BorrowsList = ({ borrows, onBorrowClick, onRepayClick }: BorrowsListProps) => {
  return (
    <DorkFiCard className="card-hover dorkfi-mb-lg">
      <div className="flex items-center gap-2 dorkfi-text-primary mb-4 text-lg font-bold">
        <ArrowUp className="w-5 h-5 text-red-400" /> Your Borrows
      </div>
      <div className="space-y-4">
        {borrows.map((borrow) => (
          <div
            key={borrow.asset}
            className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-red-500/5 border border-red-500/10 transition-all hover:bg-ocean-teal/5 hover:scale-105 hover:border-ocean-teal/40 card-hover cursor-pointer gap-3 md:gap-0"
          >
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-3 flex-1">
              <img 
                src={borrow.icon} 
                alt={borrow.asset}
                className="w-10 h-10 md:w-8 md:h-8 rounded-full flex-shrink-0"
              />
              <div className="flex flex-col min-w-0 items-center md:items-start">
                <div className="font-semibold text-base leading-tight text-slate-800 dark:text-white">{borrow.asset}</div>
                <div className="text-sm text-slate-500 dark:text-muted-foreground flex items-center justify-center md:justify-start gap-1 mt-1">
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
                <div className="text-xs text-slate-500 dark:text-muted-foreground flex items-center justify-center md:justify-start gap-1">
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
            </div>
            <div className="mt-2 md:mt-0 text-center flex-shrink-0 min-w-[110px]">
              <div className="font-semibold text-red-400">${borrow.value.toLocaleString()}</div>
              <div className="text-sm text-red-400 flex flex-col items-center gap-1 mt-1">
                <span>{borrow.apy}% APY</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Annual interest rate on your {borrow.asset} debt. This cost compounds over time, so consider repaying early to minimize interest payments.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex flex-row gap-2 mt-3 md:mt-0 md:ml-4 flex-shrink-0 justify-center md:justify-end">
              <DorkFiButton
                variant="borrow-outline"
                onClick={() => onBorrowClick(borrow.asset)}
              >Borrow</DorkFiButton>
              <DorkFiButton
                variant="danger-outline"
                onClick={() => onRepayClick(borrow.asset)}
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
