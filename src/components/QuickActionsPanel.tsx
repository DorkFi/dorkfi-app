import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import DorkFiCard from "@/components/ui/DorkFiCard";
import DorkFiButton from "@/components/ui/DorkFiButton";
import { ChevronDown, ChevronUp, Plus, Minus, ArrowDown, ArrowUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickActionsPanelProps {
  onAddCollateral?: () => void;
  onRepayDebt?: () => void;
  onDeposit?: (asset?: string, poolId?: string) => void;
  onWithdraw?: (asset?: string) => void;
  onBorrow?: (asset?: string) => void;
  totalBorrowed: number;
  deposits: Array<{
    asset: string;
    value: number;
    poolId?: string;
    isPaused?: boolean;
  }>;
  borrows: Array<{ asset: string; value: number }>;
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
                    <DorkFiButton
                      variant="secondary"
                      onClick={onAddCollateral}
                      className="w-full justify-start text-sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Collateral
                    </DorkFiButton>
                  )}
                  {hasBorrows && onRepayDebt && (
                    <DorkFiButton
                      variant="danger-outline"
                      onClick={onRepayDebt}
                      className="w-full justify-start text-sm"
                    >
                      <ArrowDown className="w-4 h-4 mr-2" />
                      Repay Debt
                    </DorkFiButton>
                  )}
                </div>
              </div>
            )}

            {/* Quick Deposit Actions - only show for non-paused markets */}
            {topDepositsForDeposit.length > 0 && onDeposit && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-green-500 flex items-center gap-2">
                  <ArrowDown className="w-4 h-4" />
                  Quick Deposit
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {topDepositsForDeposit.map((deposit) => (
                    <DorkFiButton
                      key={deposit.poolId ? `${deposit.asset}-${deposit.poolId}` : deposit.asset}
                      variant="secondary"
                      onClick={() => onDeposit(deposit.asset, deposit.poolId)}
                      className="w-full text-sm"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {deposit.asset}
                    </DorkFiButton>
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
                    <DorkFiButton
                      key={deposit.asset}
                      variant="outline"
                      onClick={() => onWithdraw(deposit.asset)}
                      className="w-full text-sm"
                    >
                      <Minus className="w-3 h-3 mr-1" />
                      {deposit.asset}
                    </DorkFiButton>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Repay Actions */}
            {topBorrows.length > 0 && onRepayDebt && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-red-500 flex items-center gap-2">
                  <ArrowDown className="w-4 h-4" />
                  Quick Repay
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {topBorrows.map((borrow) => (
                    <DorkFiButton
                      key={borrow.asset}
                      variant="danger-outline"
                      onClick={() => onRepayDebt()}
                      className="w-full text-sm"
                    >
                      <ArrowDown className="w-3 h-3 mr-1" />
                      {borrow.asset}
                    </DorkFiButton>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {topDeposits.length === 0 && topBorrows.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <p>No active positions. Start by depositing assets to earn interest.</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </DorkFiCard>
    </Collapsible>
  );
};

export default QuickActionsPanel;

