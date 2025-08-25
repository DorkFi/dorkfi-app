
import React from "react";
import { CheckCircle2, Sparkles, Trophy } from "lucide-react";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { LiquidationAccount } from '@/hooks/useLiquidationData';
import { LiquidationParams } from './EnhancedAccountDetailModal';
import { shortenAddress } from '@/utils/liquidationUtils';

interface LiquidationCongratsProps {
  account: LiquidationAccount;
  liquidationParams: LiquidationParams;
  onViewTransaction: () => void;
  onReturnToMarkets: () => void;
  onLiquidateAnother: () => void;
  onClose: () => void;
}

const LiquidationCongrats: React.FC<LiquidationCongratsProps> = ({
  account,
  liquidationParams,
  onViewTransaction,
  onReturnToMarkets,
  onLiquidateAnother,
  onClose,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 animate-fade-in">
      {/* Confetti & Sparkles */}
      <div className="relative flex flex-col items-center justify-center mb-2">
        <Sparkles className="absolute -top-3 -left-3 text-whale-gold w-7 h-7 animate-bounce" />
        <Sparkles className="absolute -top-3 -right-3 text-highlight-aqua w-7 h-7 animate-bounce animation-delay-300" />
        <Trophy className="absolute -bottom-2 -right-2 text-whale-gold w-6 h-6 animate-pulse" />
        <CheckCircle2 className="w-16 h-16 text-green-500 drop-shadow-xl bg-white dark:bg-slate-800 rounded-full p-1 border-4 border-whale-gold z-10" />
        <div className="mt-[-30px] w-32 h-32 rounded-xl shadow-md border-4 border-whale-gold mx-auto bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900 dark:to-red-800 flex items-center justify-center">
          <div className="text-red-600 dark:text-red-300 font-bold text-lg">
            {liquidationParams.collateralToken}
          </div>
        </div>
      </div>
      
      <h2 className="text-xl font-bold text-center mb-1 text-white">Liquidation Successful!</h2>
      
      <div className="text-center text-base text-slate-200 mb-2 font-medium">
        You successfully liquidated position{" "}
        <span className="text-whale-gold font-mono">{shortenAddress(account.walletAddress)}</span>
      </div>
      
      {/* Liquidation Details */}
      <div className="bg-white/10 rounded-lg p-4 w-full mb-2">
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Debt Repaid:</span>
            <span className="text-white font-semibold">
              ${liquidationParams.repayAmountUSD.toLocaleString()} {liquidationParams.repayToken}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Collateral Received:</span>
            <span className="text-ocean-teal font-semibold">
              {liquidationParams.collateralAmount.toFixed(4)} {liquidationParams.collateralToken}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Liquidation Bonus:</span>
            <span className="text-whale-gold font-semibold">
              ${liquidationParams.liquidationBonus.toLocaleString()} (5%)
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-2 w-full mt-2">
        <DorkFiButton
          variant="primary"
          className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white rounded-xl py-3 text-lg"
          onClick={onViewTransaction}
        >
          View Transaction
        </DorkFiButton>
        
        <DorkFiButton
          variant="secondary"
          className="w-full border-ocean-teal text-ocean-teal dark:border-whale-gold dark:text-whale-gold"
          onClick={onReturnToMarkets}
        >
          Return to Liquidation Markets
        </DorkFiButton>
        
        <DorkFiButton
          variant="secondary"
          className="w-full border-ocean-teal text-ocean-teal dark:border-whale-gold dark:text-whale-gold"
          onClick={onLiquidateAnother}
        >
          Liquidate Another Position
        </DorkFiButton>
      </div>
      
      <button
        type="button"
        className="text-xs underline text-slate-300 hover:text-white mt-2 transition-colors"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
};

export default LiquidationCongrats;
