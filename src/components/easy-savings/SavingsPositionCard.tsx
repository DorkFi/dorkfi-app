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
import {
  buildTrackedBalanceSeries,
  type BalanceHistoryEvent,
} from "@/services/savingsBalanceHistory";

const BALANCE_RANGES = ["W", "M", "6M", "Y", "All"] as const;
type BalanceRange = (typeof BALANCE_RANGES)[number];

export type PortfolioChartSeriesId =
  | "total"
  | "wallet"
  | "savings"
  | "higher_yield";

export type PortfolioChartSeries = {
  id: PortfolioChartSeriesId;
  label: string;
  balanceUsd: number;
  apyPercent: number | null;
  earnedInterestUsd?: number;
  /** Cashflow events for this series (deposits/withdraws). */
  historyEvents?: BalanceHistoryEvent[];
  /** Local balance samples for this series. */
  historySnapshots?: Array<{ timestamp: number; balanceUsd: number }>;
};

type SavingsPositionCardProps = {
  /** Current savings / portfolio balance in USD. */
  balanceUsd: number;
  /** Live supply APY percent (e.g. 4.15). */
  apyPercent: number | null;
  /** Optional accrued interest in USD for a more realistic growth path. */
  earnedInterestUsd?: number;
  /** Optional preformatted balance when USD price is unavailable. */
  balanceLabel?: string;
  /** Header above the balance figure. */
  title?: string;
  /**
   * Optional chart series toggles (Wallet balances page).
   * When set, the card switches balance/APY/chart with the selected series.
   */
  chartSeries?: PortfolioChartSeries[];
  /** Default series history when not using chartSeries toggles. */
  historyEvents?: BalanceHistoryEvent[];
  historySnapshots?: Array<{ timestamp: number; balanceUsd: number }>;
  className?: string;
};

const RANGE_DAYS: Record<BalanceRange, number> = {
  W: 7,
  M: 30,
  "6M": 182,
  Y: 365,
  All: 730,
};

function formatAxisUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  if (value >= 1000) {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
  return formatUsdAmount(value);
}

/** @deprecated use buildTrackedBalanceSeries from savingsBalanceHistory */
export function buildBalanceHistory(
  balanceUsd: number,
  apyPercent: number | null,
  range: BalanceRange,
  earnedInterestUsd = 0
) {
  return buildTrackedBalanceSeries({
    liveUsd: balanceUsd,
    apyPercent,
    earnedInterestUsd,
    rangeDays: RANGE_DAYS[range],
  });
}

const SavingsPositionCard = ({
  balanceUsd,
  apyPercent,
  earnedInterestUsd = 0,
  balanceLabel,
  title = "Current Balance",
  chartSeries,
  historyEvents,
  historySnapshots,
  className,
}: SavingsPositionCardProps) => {
  const [range, setRange] = useState<BalanceRange>("Y");
  const [seriesId, setSeriesId] = useState<PortfolioChartSeriesId>("total");

  const hasSeries = Boolean(chartSeries && chartSeries.length > 0);

  const activeSeries = useMemo(() => {
    if (!chartSeries?.length) return null;
    return (
      chartSeries.find((s) => s.id === seriesId) ?? chartSeries[0] ?? null
    );
  }, [chartSeries, seriesId]);

  const resolvedBalanceUsd = activeSeries?.balanceUsd ?? balanceUsd;
  const resolvedApy = activeSeries?.apyPercent ?? apyPercent;
  const resolvedEarned =
    activeSeries?.earnedInterestUsd ?? earnedInterestUsd;
  const chartBalance = Math.max(resolvedBalanceUsd, 0);

  const resolvedEvents =
    activeSeries?.historyEvents ?? historyEvents ?? [];
  const resolvedSnapshots =
    activeSeries?.historySnapshots ?? historySnapshots ?? [];

  const data = useMemo(
    () =>
      buildTrackedBalanceSeries({
        liveUsd: chartBalance,
        apyPercent: resolvedApy,
        earnedInterestUsd: resolvedEarned,
        rangeDays: RANGE_DAYS[range],
        events: resolvedEvents,
        snapshots: resolvedSnapshots,
      }),
    [
      chartBalance,
      resolvedApy,
      range,
      resolvedEarned,
      resolvedEvents,
      resolvedSnapshots,
    ]
  );

  const yMax = useMemo(() => {
    const peak = Math.max(...data.map((d) => d.value), chartBalance, 1);
    // Round up to a clean axis top similar to the reference UI.
    const magnitude = Math.pow(10, Math.floor(Math.log10(peak)));
    const step = magnitude >= 1000 ? magnitude / 2 : magnitude;
    return Math.ceil(peak / step) * step;
  }, [data, chartBalance]);

  const yTicks = useMemo(() => [0, yMax / 2, yMax], [yMax]);
  const startLabel = data[0]?.label ?? "";
  const endLabel = data[data.length - 1]?.label ?? "Today";
  const apyLabel =
    resolvedApy != null && Number.isFinite(resolvedApy)
      ? `${resolvedApy.toFixed(2)}% APY`
      : "— APY";
  const displayBalance = hasSeries
    ? formatUsdAmount(chartBalance)
    : balanceLabel ?? formatUsdAmount(chartBalance);

  const seriesTitle = hasSeries
    ? activeSeries?.label === "Total Balance"
      ? "Portfolio Balance"
      : activeSeries?.label ?? title
    : title;

  return (
    <section
      className={cn(
        "rounded-[28px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{seriesTitle}</p>
          <p className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums">
            {displayBalance}
          </p>
        </div>
        <p className="pt-1 text-sm font-medium tabular-nums shrink-0">
          {apyLabel}
        </p>
      </div>

      {hasSeries ? (
        <div className="mt-5 flex flex-wrap gap-1 rounded-full bg-muted/70 p-1">
          {chartSeries!.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeriesId(s.id)}
              className={cn(
                "flex-1 min-w-[5.5rem] rounded-full py-2 px-2 text-xs sm:text-sm font-medium transition-colors",
                seriesId === s.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="savingsBalanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5EC8F0" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#5EC8F0" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="hsl(var(--border))"
              strokeOpacity={0.7}
              vertical={false}
            />
            <XAxis dataKey="label" hide />
            <YAxis
              orientation="right"
              domain={[0, yMax]}
              ticks={yTicks}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={formatAxisUsd}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: 12,
              }}
              formatter={(value: number) => [formatUsdAmount(value), "Balance"]}
              labelFormatter={(label) => label}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#5EC8F0"
              strokeWidth={2.5}
              fill="url(#savingsBalanceFill)"
              isAnimationActive
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>

      <div className="mt-5 flex rounded-full bg-muted/70 p-1">
        {BALANCE_RANGES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRange(item)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-medium transition-colors",
              range === item
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
};

export default SavingsPositionCard;
