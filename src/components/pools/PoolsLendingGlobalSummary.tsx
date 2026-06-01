import { Skeleton } from "@/components/ui/skeleton";
import { getLendingPoolLabel, type NetworkId } from "@/config";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import type { PoolsLendingGlobalSummary as PoolsLendingGlobalSummaryData } from "@/hooks/useLiquidityPoolData";
import { Landmark } from "lucide-react";

interface PoolsLendingGlobalSummaryProps {
  filterSymbol: string;
  networkId: NetworkId;
  summary: PoolsLendingGlobalSummaryData | null;
  poolIds: string[];
  isLoading: boolean;
  walletConnected: boolean;
}

const PoolsLendingGlobalSummary = ({
  filterSymbol,
  networkId,
  summary,
  poolIds,
  isLoading,
  walletConnected,
}: PoolsLendingGlobalSummaryProps) => {
  const { formatCurrency } = useNumberI18n();

  if (poolIds.length === 0) {
    return null;
  }

  const poolLabels = poolIds.map((poolId) =>
    getLendingPoolLabel(networkId, poolId)
  );
  const poolLabelText =
    poolLabels.length === 1
      ? `Pool ${poolLabels[0]}`
      : `Pools ${poolLabels.join(", ")}`;

  return (
    <div className="mb-4 rounded-xl border border-ocean-teal/25 bg-ocean-teal/5 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Landmark
            className="mt-0.5 h-4 w-4 shrink-0 text-ocean-teal"
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {filterSymbol} lending position
            </p>
            <p className="text-xs text-muted-foreground">
              Global collateral and borrows in {poolLabelText} from {filterSymbol}{" "}
              LP markets on this page.
            </p>
          </div>
        </div>

        {!walletConnected ? (
          <p className="text-xs text-muted-foreground">
            Connect a wallet to view your position.
          </p>
        ) : isLoading || !summary ? (
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-28" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
            <div>
              <span className="text-xs text-muted-foreground">Collateral</span>
              <p className="font-semibold text-foreground">
                {formatCurrency(summary.totalCollateralValue, "USD", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Borrows</span>
              <p className="font-semibold text-foreground">
                {formatCurrency(summary.totalBorrowValue, "USD", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PoolsLendingGlobalSummary;
