
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDown, Info, RefreshCw } from "lucide-react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";

interface Deposit {
  asset: string;
  icon: string;
  balance: number;
  nTokenBalance?: number;
  value: number;
  apy: number;
  tokenPrice: number;
}

interface DepositsListProps {
  deposits: Deposit[];
  onDepositClick: (asset: string) => void;
  onWithdrawClick: (asset: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const DepositsList = ({ deposits, onDepositClick, onWithdrawClick, onRefresh, isLoading }: DepositsListProps) => {
  return (
    <DorkFiCard className="card-hover dorkfi-mb-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 dorkfi-text-primary text-lg font-bold">
          <ArrowDown className="w-5 h-5 text-green-400" /> Your Deposits
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-green-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh deposits data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>
      <div className="space-y-4">
        {deposits.map((deposit) => (
          <div 
            key={deposit.asset}
            className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-center min-h-[100px] p-4 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-gray-200/30 dark:border-ocean-teal/10 transition-all hover:bg-ocean-teal/5 hover:scale-105 hover:border-ocean-teal/40 card-hover cursor-pointer gap-y-1"
          >
            {/* Token Icon + Name (column 1) */}
            <div className="flex flex-col items-center gap-1 w-20">
              <img 
                src={deposit.icon} 
                alt={deposit.asset}
                className="w-12 h-12 md:w-10 md:h-10 rounded-full"
              />
              <div className="font-bold text-base text-slate-800 dark:text-white text-center truncate w-full">{deposit.asset}</div>
            </div>
            {/* $ value, APY, Balances & Price Info (column 2) */}
            <div className="flex flex-col items-center gap-[2px] min-w-0 text-center">
              {/* USD value (top, yellow) */}
              <div className="font-semibold text-yellow-400 text-lg mb-1 text-center">${deposit.value.toLocaleString()}</div>
              {/* APY below USD */}
              <div className="flex items-center text-base font-semibold text-yellow-400 mb-1 text-center justify-center">
                {deposit.apy.toFixed(2)}% APY
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 cursor-help flex-shrink-0 ml-1" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Annual percentage yield for this deposit position.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1 text-center justify-center">
                {deposit.balance.toLocaleString()} tokens
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>The amount of {deposit.asset} tokens you have deposited and available to use as collateral for borrowing other assets.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {deposit.nTokenBalance !== undefined && deposit.nTokenBalance > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 break-all text-center justify-center">
                  {deposit.nTokenBalance.toFixed(6)} n{deposit.asset}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 cursor-help flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Your n{deposit.asset} token balance representing your share of the {deposit.asset} lending pool. These tokens accrue interest over time.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
              <div className="text-xs text-slate-400 dark:text-muted-foreground flex items-center gap-1 text-center justify-center">
                ${deposit.tokenPrice.toFixed(3)} per token
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Current market price of {deposit.asset}. Your position value fluctuates with price changes, affecting your health factor.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            {/* USD value above Deposit/Withdraw buttons (column 3) */}
            <div className="flex flex-col items-end gap-2 min-w-[150px] pr-3">
              <DorkFiButton variant="secondary" onClick={() => onDepositClick(deposit.asset)} className="w-full max-w-[148px]">Deposit</DorkFiButton>
              <DorkFiButton variant="danger-outline" onClick={() => onWithdrawClick(deposit.asset)} className="w-full max-w-[148px]">Withdraw</DorkFiButton>
            </div>
          </div>
        ))}
        {deposits.length === 0 && (
          <div className="text-center py-8 dorkfi-text-secondary">
            <p>No active deposits</p>
          </div>
        )}
      </div>
    </DorkFiCard>
  );
};

export default DepositsList;
