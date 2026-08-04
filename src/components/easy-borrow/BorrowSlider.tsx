import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type BorrowSliderProps = {
  /** Current loan-to-value percentage (0–100+). */
  ltvPercent: number;
  /** Protocol max LTV (collateral factor × 100). */
  maxLtvPercent: number;
  /** Liquidation threshold percentage. */
  liquidationPercent: number;
  onChange: (ltvPercent: number) => void;
  disabled?: boolean;
};

const BANDS = [
  { key: "conservative", label: "Conservative", at: 0 },
  { key: "moderate", label: "Moderate", at: 0.4 },
  { key: "aggressive", label: "Aggressive", at: 0.75 },
  { key: "liquidation", label: "Liquidation", at: 1 },
] as const;

function activeBand(
  ltv: number,
  maxLtv: number,
  liquidation: number
): (typeof BANDS)[number]["key"] {
  if (liquidation > 0 && ltv >= liquidation * 0.98) return "liquidation";
  if (maxLtv <= 0) return "conservative";
  const ratio = ltv / maxLtv;
  if (ratio >= 0.75) return "aggressive";
  if (ratio >= 0.4) return "moderate";
  return "conservative";
}

const BorrowSlider = ({
  ltvPercent,
  maxLtvPercent,
  liquidationPercent,
  onChange,
  disabled,
}: BorrowSliderProps) => {
  const trackMax = Math.max(liquidationPercent, maxLtvPercent, 1);
  const safeLtv = Math.min(
    Math.max(0, Number.isFinite(ltvPercent) ? ltvPercent : 0),
    maxLtvPercent > 0 ? maxLtvPercent : trackMax
  );
  const band = activeBand(safeLtv, maxLtvPercent, liquidationPercent);
  const liqPos = trackMax > 0 ? (liquidationPercent / trackMax) * 100 : 100;
  const maxPos = trackMax > 0 ? (maxLtvPercent / trackMax) * 100 : 80;

  return (
    <div className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">
            Loan to Value (LTV)
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The percentage of your collateral value being borrowed
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-semibold tabular-nums leading-none">
            {safeLtv.toFixed(2)}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            max. {maxLtvPercent > 0 ? maxLtvPercent.toFixed(2) : "—"}%
          </p>
        </div>
      </div>

      <div className="relative pt-5 pb-1">
        {liquidationPercent > 0 && liquidationPercent <= trackMax ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
            style={{ left: `${liqPos}%` }}
          >
            <span className="block text-xs font-semibold tabular-nums text-ocean-teal">
              {liquidationPercent.toFixed(2)}%
            </span>
            <span className="mx-auto mt-0.5 block h-3 w-px bg-ocean-teal" />
            <span className="mx-auto block h-3 w-px bg-ocean-teal" />
          </div>
        ) : null}

        <Slider
          disabled={disabled || maxLtvPercent <= 0}
          value={[safeLtv]}
          min={0}
          max={maxLtvPercent > 0 ? maxLtvPercent : trackMax}
          step={0.01}
          onValueChange={(vals) => onChange(vals[0] ?? 0)}
          className={cn(
            "[&_[role=slider]]:size-5 [&_[role=slider]]:border-ocean-teal [&_[role=slider]]:bg-ocean-teal",
            "[&_[data-orientation=horizontal]>span:first-child>span]:bg-ocean-teal"
          )}
        />

        {/* Soft max-LTV tick when below liquidation */}
        {maxLtvPercent > 0 && maxLtvPercent < trackMax ? (
          <div
            className="pointer-events-none absolute bottom-0 top-5 z-0 w-px bg-border"
            style={{ left: `${maxPos}%` }}
            aria-hidden
          />
        ) : null}
      </div>

      <div className="relative h-5">
        {BANDS.map((b) => {
          const left =
            b.key === "liquidation"
              ? liqPos
              : b.at * (maxLtvPercent > 0 ? maxPos : 100);
          return (
            <span
              key={b.key}
              className={cn(
                "absolute top-0 -translate-x-1/2 text-xs whitespace-nowrap",
                band === b.key
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
              style={{
                left: `${Math.min(100, Math.max(0, left))}%`,
                ...(b.key === "conservative"
                  ? { transform: "none", left: 0 }
                  : b.key === "liquidation"
                    ? { transform: "translateX(-100%)", left: `${liqPos}%` }
                    : null),
              }}
            >
              {b.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default BorrowSlider;
