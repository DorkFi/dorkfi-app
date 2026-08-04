import {
  getHealthFactorStatusLabel,
  getHealthFactorTextColorClass,
} from "@/utils/healthFactorUx";
import { healthBandLabel, previewHealthBand } from "@/utils/easyBorrowMath";
import { cn } from "@/lib/utils";

type HealthPreviewProps = {
  before: number | null;
  after: number | null;
};

function formatHf(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

const HealthPreview = ({ before, after }: HealthPreviewProps) => {
  const band = previewHealthBand(after);
  const showWarning = band === "at_risk" || band === "warning";
  const blocked = band === "blocked";

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        blocked
          ? "border-destructive/40 bg-destructive/10"
          : showWarning
            ? "border-amber-500/40 bg-amber-500/10"
            : "border-border/60 bg-muted/20"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Portfolio Health</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {healthBandLabel(band)}
            {after != null ? ` · ${getHealthFactorStatusLabel(after)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Current → After</p>
          <p className="text-lg font-semibold tabular-nums">
            <span className={getHealthFactorTextColorClass(before)}>
              {formatHf(before)}
            </span>
            <span className="text-muted-foreground mx-1.5">→</span>
            <span className={getHealthFactorTextColorClass(after)}>
              {formatHf(after)}
            </span>
          </p>
        </div>
      </div>
      {blocked ? (
        <p className="mt-2 text-xs text-destructive">
          This borrow would put your position at or below liquidation. Reduce
          the amount or add more collateral.
        </p>
      ) : showWarning ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          This position would be close to liquidation. Consider borrowing less.
        </p>
      ) : null}
    </div>
  );
};

export default HealthPreview;
