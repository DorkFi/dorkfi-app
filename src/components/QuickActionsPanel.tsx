import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { ChevronDown, ChevronUp, Plus, Minus, ArrowDown, ArrowUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuickActionsPanelProps {
  onAddCollateral?: () => void;
  /** When called with no args, opens repay for largest borrow; with (asset, poolId, network), opens repay for that position. */
  onRepayDebt?: (asset?: string, poolId?: string, network?: string) => void;
  onDeposit?: (asset?: string, poolId?: string) => void;
  onWithdraw?: (asset?: string) => void;
  onBorrow?: (asset?: string, poolId?: string, network?: string) => void;
  totalBorrowed: number;
  deposits: Array<{
    asset: string;
    value: number;
    poolId?: string;
    isPaused?: boolean;
  }>;
  borrows: Array<{ asset: string; value: number; poolId?: string; network?: string }>;
  healthFactor: number | null;
}

const QuickActionsPanel = ({
  onAddCollateral,
  onRepayDebt,
  onDeposit,
  onWithdraw,
  onBorrow,
  totalBorrowed,
  deposits,
  borrows,
  healthFactor,
}: QuickActionsPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Default open on desktop for discoverability
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setIsOpen(true);
    }
  }, []);

  // Get top 3 deposits and borrows for quick actions
  const topDeposits = deposits
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  // For Quick Deposit, exclude paused markets (deposits not allowed when paused)
  const topDepositsForDeposit = topDeposits.filter((d) => !d.isPaused);

  const topBorrows = borrows
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const hasLowHealthFactor = healthFactor !== null && healthFactor < 1.5;
  const hasBorrows = totalBorrowed > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <DorkFiCard className="card-hover dorkfi-mb-lg">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 hover:bg-ocean-teal/5"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-lg font-semibold dorkfi-text-primary">
                Quick Actions
              </span>
            </div>
            {!isOpen && (topDeposits.length > 0 || topBorrows.length > 0) && (
              <span className="text-xs text-muted-foreground font-normal hidden sm:inline">
                Supply · Withdraw · Borrow · Repay
              </span>
            )}
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 sm:px-4 pb-4 space-y-4">
            {/* Critical Actions - Show if health factor is low */}
            {hasLowHealthFactor && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-orange-500 flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                  Urgent Actions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {onAddCollateral && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DorkFiButton
                          variant="secondary"
                          onClick={onAddCollateral}
                          className="w-full justify-start text-sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Supply
                        </DorkFiButton>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Add assets to earn yield and strengthen your health factor.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {hasBorrows && onRepayDebt && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DorkFiButton
                          variant="danger-outline"
                          onClick={() => onRepayDebt()}
                          className="w-full justify-start text-sm"
                        >
                          <ArrowDown className="w-4 h-4 mr-2" />
                          Repay Debt
                        </DorkFiButton>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Pay down debt to improve your health factor and avoid liquidation risk.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}

            {/* Quick Supply Actions - only show for non-paused markets */}
            {topDepositsForDeposit.length > 0 && onDeposit && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-green-500 flex items-center gap-2">
                  <ArrowDown className="w-4 h-4" />
                  Quick Supply
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {topDepositsForDeposit.map((deposit) => (
                    <Tooltip key={deposit.poolId ? `${deposit.asset}-${deposit.poolId}` : deposit.asset}>
                      <TooltipTrigger asChild>
                        <DorkFiButton
                          variant="secondary"
                          onClick={() => onDeposit(deposit.asset, deposit.poolId)}
                          className="w-full text-sm"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {deposit.asset}
                        </DorkFiButton>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Supply {deposit.asset} to earn yield and use as collateral.</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Withdraw Actions */}
            {topDeposits.length > 0 && onWithdraw && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-blue-500 flex items-center gap-2">
                  <ArrowUp className="w-4 h-4" />
                  Quick Withdraw
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {topDeposits.map((deposit) => (
                    <Tooltip key={deposit.poolId ? `${deposit.asset}-${deposit.poolId}` : deposit.asset}>
                      <TooltipTrigger asChild>
                        <DorkFiButton
                          variant="withdraw"
                          onClick={() => onWithdraw(deposit.asset)}
                          className="w-full text-sm"
                        >
                          <Minus className="w-3 h-3 mr-1" />
                          {deposit.asset}
                        </DorkFiButton>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Withdraw supplied {deposit.asset} back to your wallet.</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Borrow Actions - borrow more of an asset you already have */}
            {topBorrows.length > 0 && onBorrow && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-amber-500 flex items-center gap-2">
                  <ArrowUp className="w-4 h-4" />
                  Quick Borrow
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {topBorrows.map((borrow) => (
                    <Tooltip key={borrow.poolId ? `${borrow.asset}-${borrow.poolId}` : borrow.asset}>
                      <TooltipTrigger asChild>
                        <DorkFiButton
                          variant="outline"
                          onClick={() => onBorrow(borrow.asset, borrow.poolId, borrow.network)}
                          className="w-full text-sm border-amber-500/50 hover:bg-amber-500/10"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {borrow.asset}
                        </DorkFiButton>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Borrow more {borrow.asset} against your collateral.</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Repay Actions - per-asset so each button opens repay for that asset */}
            {topBorrows.length > 0 && onRepayDebt && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-red-500 flex items-center gap-2">
                  <ArrowDown className="w-4 h-4" />
                  Quick Repay
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {topBorrows.map((borrow) => (
                    <Tooltip key={borrow.poolId ? `${borrow.asset}-${borrow.poolId}` : borrow.asset}>
                      <TooltipTrigger asChild>
                        <DorkFiButton
                          variant="danger-outline"
                          onClick={() => onRepayDebt(borrow.asset, borrow.poolId, borrow.network)}
                          className="w-full text-sm"
                        >
                          <ArrowDown className="w-3 h-3 mr-1" />
                          {borrow.asset}
                        </DorkFiButton>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Repay {borrow.asset} debt to improve health factor.</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {topDeposits.length === 0 && topBorrows.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <p>No active positions. Start by supplying assets to earn interest.</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </DorkFiCard>
    </Collapsible>
  );
};

export default QuickActionsPanel;

