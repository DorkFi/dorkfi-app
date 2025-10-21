
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
            className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-gray-200/30 dark:border-ocean-teal/10 transition-all hover:bg-ocean-teal/5 hover:scale-105 hover:border-ocean-teal/40 card-hover cursor-pointer gap-3 md:gap-0"
          >
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-3 flex-1">
              <img 
                src={deposit.icon} 
                alt={deposit.asset}
                className="w-10 h-10 md:w-8 md:h-8 rounded-full flex-shrink-0"
              />
              <div className="flex flex-col min-w-0 items-center md:items-start">
                <div className="font-semibold text-base leading-tight text-slate-800 dark:text-white">{deposit.asset}</div>
                <div className="text-sm text-slate-500 dark:text-muted-foreground flex items-center justify-center md:justify-start gap-1 mt-1">
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
                  <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center md:justify-start gap-1">
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
                <div className="text-xs text-slate-500 dark:text-muted-foreground flex items-center justify-center md:justify-start gap-1">
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
            </div>
            <div className="mt-2 md:mt-0 text-center flex-shrink-0 min-w-[110px]">
              <div className="font-semibold text-whale-gold">${deposit.value.toLocaleString()}</div>
              <div className="text-sm text-whale-gold flex flex-col items-center gap-1 mt-1">
                <span>{deposit.apy.toFixed(2)}% APY</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Annual Percentage Yield - the interest rate you earn on your {deposit.asset} deposits. Rewards are typically distributed automatically.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex flex-row gap-2 mt-3 md:mt-0 md:ml-4 flex-shrink-0 justify-center md:justify-end">
              <DorkFiButton
                variant="secondary"
                onClick={() => onDepositClick(deposit.asset)}
                className="min-h-[44px] min-w-[92px] font-semibold text-sm"
              >Deposit</DorkFiButton>
              <DorkFiButton
                variant="danger-outline"
                onClick={() => onWithdrawClick(deposit.asset)}
                className="min-h-[44px] min-w-[92px] font-semibold text-sm"
              >Withdraw</DorkFiButton>
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
