import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, formatUsdAmount } from "@/lib/utils";

const HORIZONS = [
  { id: "3m", label: "3 months", years: 0.25 },
  { id: "6m", label: "6 months", years: 0.5 },
  { id: "1y", label: "1 year", years: 1 },
  { id: "5y", label: "5 years", years: 5 },
] as const;

const PRESET_PRINCIPALS = [500, 1000, 5000, 10000] as const;

/** Daily compound approximation of continuous protocol rewards. */
const COMPOUNDS_PER_YEAR = 365;

type SimpleSavingsCalculatorProps = {
  /** Live market APY percent (e.g. 5.95). */
  apyPercent: number | null;
  className?: string;
};

function compoundFutureValue(
  principal: number,
  apyPercent: number,
  years: number,
  n = COMPOUNDS_PER_YEAR
): number {
  if (!Number.isFinite(principal) || principal < 0) return 0;
  if (!Number.isFinite(apyPercent) || apyPercent <= 0 || years <= 0) {
    return principal;
  }
  const r = apyPercent / 100;
  return principal * Math.pow(1 + r / n, n * years);
}

function formatAxisUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  if (value >= 1000) return `$${Math.round(value).toLocaleString("en-US")}`;
  return formatUsdAmount(value);
}

/**
 * Pre-login marketing calculator: principal × live APY, daily compounding.
 */
export function SimpleSavingsCalculator({
  apyPercent,
  className,
}: SimpleSavingsCalculatorProps) {
  const [principalInput, setPrincipalInput] = useState("1000");
  const [horizonId, setHorizonId] =
    useState<(typeof HORIZONS)[number]["id"]>("1y");
  const [apyOverride, setApyOverride] = useState<string | null>(null);

  const principal = (() => {
    const n = Number.parseFloat(principalInput.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();

  const apy =
    apyOverride != null && apyOverride.trim() !== ""
      ? Number.parseFloat(apyOverride)
      : apyPercent != null && Number.isFinite(apyPercent)
        ? apyPercent
        : null;

  const horizon =
    HORIZONS.find((h) => h.id === horizonId) ?? HORIZONS[2];

  const futureValue =
    apy != null && Number.isFinite(apy)
      ? compoundFutureValue(principal, apy, horizon.years)
      : principal;
  const interestEarned = Math.max(0, futureValue - principal);

  const chartData = useMemo(() => {
    if (principal <= 0 || apy == null || !Number.isFinite(apy) || apy <= 0) {
      return [{ label: "Start", months: 0, value: principal }];
    }
    const totalMonths = Math.max(1, Math.round(horizon.years * 12));
    const points: Array<{ label: string; months: number; value: number }> = [];
    for (let m = 0; m <= totalMonths; m++) {
      const years = m / 12;
      const value = compoundFutureValue(principal, apy, years);
      points.push({
        months: m,
        value,
        label:
          m === 0
            ? "Start"
            : m % 12 === 0
              ? `${m / 12}y`
              : totalMonths <= 12
                ? `${m}m`
                : m % 3 === 0
                  ? `${m}m`
                  : "",
      });
    }
    return points;
  }, [principal, apy, horizon.years]);

  return (
    <section
      className={cn(
        "rounded-[28px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Savings calculator
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estimate growth with daily compounding at today&apos;s savings rate.
          </p>
        </div>
        {apy != null && Number.isFinite(apy) ? (
          <p className="text-sm tabular-nums text-muted-foreground shrink-0">
            Rate{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {apy.toFixed(2)}%
            </span>{" "}
            APY
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Loading rate…</p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <div>
            <label
              htmlFor="savings-calc-principal"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Starting amount
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_PRINCIPALS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPrincipalInput(String(preset))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    principal === preset
                      ? "border-ocean-teal bg-ocean-teal/10 text-ocean-teal"
                      : "border-border/60 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {formatUsdAmount(preset)}
                </button>
              ))}
            </div>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                id="savings-calc-principal"
                type="number"
                min={0}
                step={100}
                value={principalInput}
                onChange={(e) => setPrincipalInput(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-background pl-7 pr-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ocean-teal/40"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Time horizon
            </p>
            <div className="mt-2 flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
              {HORIZONS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setHorizonId(h.id)}
                  className={cn(
                    "flex-1 min-w-[4.5rem] rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    horizonId === h.id
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="savings-calc-apy"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              APY %
            </label>
            <input
              id="savings-calc-apy"
              type="number"
              min={0}
              max={100}
              step={0.01}
              placeholder={
                apyPercent != null && Number.isFinite(apyPercent)
                  ? apyPercent.toFixed(2)
                  : "—"
              }
              value={
                apyOverride ??
                (apyPercent != null && Number.isFinite(apyPercent)
                  ? apyPercent.toFixed(2)
                  : "")
              }
              onChange={(e) => setApyOverride(e.target.value)}
              className="mt-2 w-full max-w-[10rem] rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ocean-teal/40"
            />
            {apyOverride != null &&
            apyPercent != null &&
            Number.isFinite(apyPercent) ? (
              <button
                type="button"
                className="mt-1.5 text-xs text-ocean-teal hover:underline"
                onClick={() => setApyOverride(null)}
              >
                Reset to live rate ({apyPercent.toFixed(2)}%)
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-muted/40 p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Estimated balance after {horizon.label}
            </p>
            <p className="mt-1 text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight text-foreground">
              {formatUsdAmount(futureValue)}
            </p>
            <p className="mt-2 text-sm tabular-nums">
              <span className="text-muted-foreground">Interest earned </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatUsdAmount(interestEarned)}
              </span>
            </p>
          </div>

          <div className="h-48 sm:h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="savingsCalcFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="rgb(16 185 129)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="rgb(16 185 129)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/60"
                  vertical={false}
                />
                <XAxis
                  dataKey="months"
                  tickFormatter={(m) => {
                    const pt = chartData.find((p) => p.months === m);
                    return pt?.label || "";
                  }}
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatAxisUsd}
                  tick={{ fontSize: 11 }}
                  width={48}
                  axisLine={false}
                  tickLine={false}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                  formatter={(value: number) => [
                    formatUsdAmount(value),
                    "Balance",
                  ]}
                  labelFormatter={(m) => {
                    const months = Number(m);
                    if (months === 0) return "Start";
                    if (months % 12 === 0) return `${months / 12} year(s)`;
                    return `${months} month(s)`;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="rgb(16 185 129)"
                  strokeWidth={2}
                  fill="url(#savingsCalcFill)"
                  isAnimationActive
                  animationDuration={400}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        Estimate only · uses daily compounding · rates change with market
        conditions · not financial advice
      </p>
    </section>
  );
}

export default SimpleSavingsCalculator;
