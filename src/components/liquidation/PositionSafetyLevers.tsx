import React, { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";

type Props = {
  /** Contract-weighted collateral value (USD). */
  totalCollateral: number;
  /** Total borrow value (USD). */
  totalBorrowed: number;
  /** Weighted average collateral factor across deposits (0..1). */
  weightedCollateralFactor: number;
  /** Weighted liquidation threshold (0..1). Conservative if unknown. */
  weightedLiquidationThreshold: number;
  onAddCollateral?: () => void;
  onRepayDebt?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function PositionSafetyLevers({
  totalCollateral,
  totalBorrowed,
  weightedCollateralFactor,
  weightedLiquidationThreshold,
  onAddCollateral,
  onRepayDebt,
}: Props) {
  const { formatCurrency, formatNumber, formatPercent } = useNumberI18n();

  const [targetHf, setTargetHf] = useState(1.3);
  const [shockPct, setShockPct] = useState(20);

  const model = useMemo(() => {
    const borrow = Math.max(0, Number(totalBorrowed) || 0);
    const cf = clamp(Number(weightedCollateralFactor) || 0, 0.01, 1);
    const lt = clamp(Number(weightedLiquidationThreshold) || 0.85, 0.01, 1);

    // Approximate "raw" collateral (pre-collateral-factor) from the contract-weighted collateral value.
    // This keeps levers intuitive while staying consistent with the existing totals displayed in-app.
    const rawCollateral = Math.max(0, (Number(totalCollateral) || 0) / cf);
    const shock = clamp(shockPct / 100, 0, 0.9);
    const shockedRawCollateral = rawCollateral * (1 - shock);

    const liquidationAdjustedCollateral = shockedRawCollateral * lt;
    const currentHf =
      borrow > 0 ? liquidationAdjustedCollateral / borrow : rawCollateral > 0 ? 10 : null;

    const target = clamp(targetHf, 1.01, 5);
    const repayNeeded =
      borrow > 0 ? Math.max(0, borrow - liquidationAdjustedCollateral / target) : 0;

    const addRawCollateralNeeded =
      borrow > 0 ? Math.max(0, (target * borrow) / lt - shockedRawCollateral) : 0;

    return {
      cf,
      lt,
      borrow,
      rawCollateral,
      shockedRawCollateral,
      liquidationAdjustedCollateral,
      currentHf,
      repayNeeded,
      addRawCollateralNeeded,
    };
  }, [
    shockPct,
    targetHf,
    totalBorrowed,
    totalCollateral,
    weightedCollateralFactor,
    weightedLiquidationThreshold,
  ]);

  const riskLabel =
    model.currentHf === null
      ? { text: "No position", cls: "text-muted-foreground" }
      : model.currentHf < 1
        ? { text: "Liquidatable", cls: "text-red-400" }
        : model.currentHf < 1.2
          ? { text: "Risky", cls: "text-orange-400" }
          : model.currentHf < 1.5
            ? { text: "Moderate", cls: "text-yellow-400" }
            : { text: "Safe", cls: "text-emerald-400" };

  const canAct = model.borrow > 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="text-xs text-muted-foreground">
          Tune your target Health Factor and see how much you’d need to repay or add as collateral.
        </div>
        <div className="text-right">
          <div className={`text-sm font-semibold ${riskLabel.cls}`}>
            {model.currentHf === null
              ? "—"
              : formatNumber(model.currentHf, { maximumFractionDigits: 3 })}
          </div>
          <div className={`text-xs ${riskLabel.cls}`}>{riskLabel.text}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Target HF
            </div>
            <div className="text-xs text-muted-foreground">
              {targetHf.toFixed(2)}
            </div>
          </div>
          <Slider
            value={[targetHf]}
            min={1.05}
            max={3}
            step={0.05}
            onValueChange={(v) => setTargetHf(v[0] ?? 1.3)}
          />
          <div className="text-[11px] text-muted-foreground">
            Higher targets require more repayment/collateral but reduce liquidation risk.
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Collateral price shock
            </div>
            <div className="text-xs text-muted-foreground">
              -{shockPct}%
            </div>
          </div>
          <Slider
            value={[shockPct]}
            min={0}
            max={60}
            step={1}
            onValueChange={(v) => setShockPct(Math.round(v[0] ?? 20))}
          />
          <div className="text-[11px] text-muted-foreground">
            Stress test assumption. Borrow value held constant.
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/70 dark:bg-slate-900/30 p-3">
          <div className="text-[11px] text-muted-foreground">Borrow value</div>
          <div className="text-sm font-semibold text-slate-800 dark:text-white">
            {formatCurrency(model.borrow, "USD", { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/70 dark:bg-slate-900/30 p-3">
          <div className="text-[11px] text-muted-foreground">
            Liquidation threshold (approx.)
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-white">
            {formatPercent(model.lt, { maximumFractionDigits: 1 })}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/70 dark:bg-slate-900/30 p-3">
          <div className="text-[11px] text-muted-foreground">
            Collateral factor (avg.)
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-white">
            {formatPercent(model.cf, { maximumFractionDigits: 1 })}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-ocean-teal/20 bg-gradient-to-br from-cyan-50/70 to-sky-50/50 dark:from-slate-900/40 dark:to-slate-950/30 p-3">
        {!canAct ? (
          <div className="text-sm text-muted-foreground">
            No borrows detected. You’re not at liquidation risk.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div>
              <div className="text-xs text-muted-foreground">To reach target HF</div>
              <div className="mt-1 text-sm text-slate-800 dark:text-white">
                <span className="font-semibold">Repay</span>{" "}
                <span className="font-semibold">
                  {formatCurrency(model.repayNeeded, "USD", { maximumFractionDigits: 2 })}
                </span>
                <span className="text-muted-foreground"> or </span>
                <span className="font-semibold">add collateral</span>{" "}
                <span className="font-semibold">
                  {formatCurrency(model.addRawCollateralNeeded, "USD", { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Estimate uses portfolio-level averages. Exact per-asset actions depend on which markets you repay/supply.
              </div>
            </div>
            <div className="flex gap-2 md:justify-end">
              {onRepayDebt && (
                <Button
                  variant="outline"
                  className="border-slate-300 dark:border-slate-700"
                  onClick={onRepayDebt}
                >
                  Repay debt
                </Button>
              )}
              {onAddCollateral && (
                <Button
                  className="bg-ocean-teal hover:bg-ocean-teal/90 text-slate-900"
                  onClick={onAddCollateral}
                >
                  Add collateral
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

