
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDown, Info, RefreshCw } from "lucide-react";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { useNetwork } from "@/contexts/NetworkContext";
import { getNetworkConfig } from "@/config";

interface Deposit {
  asset: string;
  icon: string;
  balance: number;
  nTokenBalance?: number;
  value: number;
  apy: number;
  tokenPrice: number;
  poolId?: string;
  network?: string;
  accruedInterest?: number;
  accruedInterestValue?: number;
}

interface DepositsListProps {
  deposits: Deposit[];
  onDepositClick: (asset: string, poolId?: string) => void;
  onWithdrawClick: (asset: string, poolId?: string, networkId?: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const DepositsList = ({ deposits, onDepositClick, onWithdrawClick, onRefresh, isLoading }: DepositsListProps) => {
  const { currentNetwork } = useNetwork();
  
  // Helper function to get market label (A or B) based on poolId
  const getMarketLabel = (poolId?: string): string | null => {
    if (!poolId) return null;
    const networkConfig = getNetworkConfig(currentNetwork);
    const lendingPools = networkConfig?.contracts?.lendingPools || [];
    if (lendingPools.length >= 2) {
      if (String(poolId) === String(lendingPools[0])) return "A";
      if (String(poolId) === String(lendingPools[1])) return "B";
    }
    return null;
  };
  
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
        {deposits.map((deposit) => {
          const marketLabel = getMarketLabel(deposit.poolId);
          // Use both asset and poolId for unique key to handle multiple markets for same token
          const uniqueKey = deposit.poolId ? `${deposit.asset}-${deposit.poolId}` : deposit.asset;
          return (
            <div 
              key={uniqueKey}
              className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto] gap-x-2 sm:gap-x-4 items-center min-h-[100px] p-3 sm:p-4 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-gray-200/30 dark:border-ocean-teal/10 transition-all hover:bg-ocean-teal/5 hover:scale-[1.02] sm:hover:scale-105 hover:border-ocean-teal/40 card-hover cursor-pointer gap-y-1"
            >
              {/* Token Icon + Name (column 1) */}
              <div className="flex flex-col items-center gap-1 w-16 sm:w-20">
                <div className="relative flex-shrink-0">
                  <img 
                    src={deposit.icon} 
                    alt={deposit.asset}
                    className="w-10 h-10 sm:w-12 sm:h-12 md:w-10 md:h-10 rounded-full"
                  />
                  {marketLabel && (
                    <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${
                      marketLabel === "A" 
                        ? "bg-blue-500 dark:bg-blue-600" 
                        : "bg-purple-500 dark:bg-purple-600"
                    } border-2 border-white dark:border-slate-800 flex items-center justify-center`}>
                      <span className="text-xs font-bold text-white">{marketLabel}</span>
                    </div>
                  )}
                </div>
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
              {deposit.accruedInterest !== undefined && deposit.accruedInterest > 0 && (
                <div className="text-xs text-green-500 dark:text-green-400 flex items-center gap-1 text-center justify-center font-medium">
                  +{deposit.accruedInterest.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })} {deposit.asset} earned
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 cursor-help flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">Accrued Interest</p>
                      <p className="text-sm">
                        Interest earned on this deposit since you deposited. 
                        {deposit.accruedInterestValue && (
                          <span className="block mt-1">
                            Value: ${deposit.accruedInterestValue.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </p>
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
            <div className="flex flex-col items-end gap-2 min-w-[120px] sm:min-w-[150px] pr-2 sm:pr-3">
              <DorkFiButton variant="secondary" onClick={() => onDepositClick(deposit.asset, deposit.poolId)} className="w-full max-w-[120px] sm:max-w-[148px] text-xs sm:text-sm">Deposit</DorkFiButton>
              <DorkFiButton variant="danger-outline" onClick={() => onWithdrawClick(deposit.asset, deposit.poolId, deposit.network)} className="w-full max-w-[120px] sm:max-w-[148px] text-xs sm:text-sm">Withdraw</DorkFiButton>
            </div>
          </div>
          );
        })}
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
