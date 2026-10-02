import { useEffect, useMemo, useState } from "react";
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
  | "cash_out"
  | "algorand"
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
  /** True while the live Earn/savings balance is still loading. */
  isLoading?: boolean;
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

const MOBILE_BUCKET_ORDER: PortfolioChartSeriesId[] = [
  "savings",
  "higher_yield",
  "cash_out",
  "wallet",
  "algorand",
];

const BUCKET_COLOR: Partial<Record<PortfolioChartSeriesId, string>> = {
  savings: "#1F9A8A",
  higher_yield: "#0F766E",
  cash_out: "#5EC8F0",
  wallet: "#5EC8F0",
  algorand: "#D5DCE3",
};

function useIsSmUp(): boolean {
  const [isSmUp, setIsSmUp] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 640px)").matches
      : false
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const update = () => setIsSmUp(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isSmUp;
}

function formatApy(apyPercent: number | null | undefined): string | null {
  if (apyPercent == null || !Number.isFinite(apyPercent)) return null;
  return `${apyPercent.toFixed(2)}% APY`;
}

function showsBucketRate(series: PortfolioChartSeries): boolean {
  return (
    (series.id === "savings" || series.id === "higher_yield") &&
    series.apyPercent != null &&
    Number.isFinite(series.apyPercent)
  );
}

/** Accrued interest worth showing on the mobile Earning row. */
function earnedCaption(series: PortfolioChartSeries): string | null {
  const earned = series.earnedInterestUsd;
  if (
    (series.id !== "savings" && series.id !== "higher_yield") ||
    earned == null ||
    !Number.isFinite(earned) ||
    earned <= 0.01
  ) {
    return null;
  }
  return `Earned ${formatUsdAmount(earned)}`;
}

/** One-line names for the balance grid. Full phrases stay on the button label. */
function seriesShortLabel(series: PortfolioChartSeries): string {
  switch (series.id) {
    case "total":
      return "Total";
    case "cash_out":
      return "Cash out";
    case "wallet":
      return "Transfer";
    case "algorand":
      return series.label === "On Algorand" ? "Algorand" : "To move";
    case "savings":
      return "Earning";
    case "higher_yield":
      return "Higher yield";
    default:
      return series.label;
  }
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
  isLoading = false,
  chartSeries,
  historyEvents,
  historySnapshots,
  className,
}: SavingsPositionCardProps) => {
  const [range, setRange] = useState<BalanceRange>("W");
  const [seriesId, setSeriesId] = useState<PortfolioChartSeriesId>("total");
  const isSmUp = useIsSmUp();

  const hasSeries = Boolean(chartSeries && chartSeries.length > 0);

  const activeSeries = useMemo(() => {
    if (!chartSeries?.length) return null;
    return (
      chartSeries.find((s) => s.id === seriesId) ?? chartSeries[0] ?? null
    );
  }, [chartSeries, seriesId]);

  const totalSeries = useMemo(
    () => chartSeries?.find((s) => s.id === "total") ?? null,
    [chartSeries]
  );

  const mobileBuckets = useMemo(() => {
    if (!chartSeries?.length) return [];
    const byId = new Map(chartSeries.map((s) => [s.id, s]));
    return MOBILE_BUCKET_ORDER.flatMap((id) => {
      const series = byId.get(id);
      return series && series.balanceUsd > 0.01 ? [series] : [];
    });
  }, [chartSeries]);

  const mobileBucketTotal = mobileBuckets.reduce(
    (sum, series) => sum + Math.max(series.balanceUsd, 0),
    0
  );

  // Phones keep the chart on the portfolio total. Wider screens follow the selected tile.
  const chartDriver =
    !isSmUp && hasSeries && totalSeries ? totalSeries : activeSeries;

  const resolvedEarned =
    chartDriver?.earnedInterestUsd ?? earnedInterestUsd;
  const chartBalance = Math.max(
    chartDriver?.balanceUsd ?? balanceUsd,
    0
  );
  const chartApy = chartDriver?.apyPercent ?? apyPercent;

  const resolvedEvents =
    chartDriver?.historyEvents ?? historyEvents ?? [];
  const resolvedSnapshots =
    chartDriver?.historySnapshots ?? historySnapshots ?? [];

  const data = useMemo(
    () =>
      buildTrackedBalanceSeries({
        liveUsd: chartBalance,
        apyPercent: chartApy,
        earnedInterestUsd: resolvedEarned,
        rangeDays: RANGE_DAYS[range],
        events: resolvedEvents,
        snapshots: resolvedSnapshots,
      }),
    [
      chartBalance,
      chartApy,
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
  const apyLabel = formatApy(chartApy) ?? "— APY";
  const displayBalance = hasSeries
    ? formatUsdAmount(chartBalance)
    : balanceLabel ?? formatUsdAmount(chartBalance);

  const seriesTitle = hasSeries
    ? !isSmUp
      ? title
      : activeSeries?.label === "Total Balance"
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
      <div>
        <p className="text-sm text-muted-foreground">{seriesTitle}</p>
        {isLoading ? (
          <p
            className="mt-1 h-9 w-36 rounded-md bg-muted animate-pulse"
            aria-label="Loading balance"
          />
        ) : (
          <p className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums">
            {displayBalance}
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {apyLabel}
        </p>
      </div>

      {hasSeries ? (
        <div className="mt-5 hidden grid-cols-2 gap-3 sm:grid">
          {chartSeries!.map((s) => {
            const selected = activeSeries?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={selected}
                aria-label={`${s.label}, ${formatUsdAmount(Math.max(s.balanceUsd, 0))}`}
                onClick={() => setSeriesId(s.id)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-border bg-muted/80 text-foreground shadow-sm"
                    : "border-border/50 bg-muted/25 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <span className="block text-sm font-medium">
                  {seriesShortLabel(s)}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-lg font-semibold tabular-nums",
                    selected ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {formatUsdAmount(Math.max(s.balanceUsd, 0))}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 h-36 w-full sm:mt-6 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: isSmUp ? 8 : 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="savingsBalanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5EC8F0" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#5EC8F0" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {isSmUp ? (
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeOpacity={0.7}
                vertical={false}
              />
            ) : null}
            <XAxis dataKey="label" hide />
            {isSmUp ? (
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
            ) : (
              <YAxis hide domain={[0, yMax]} width={0} />
            )}
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

      {mobileBuckets.length > 0 && mobileBucketTotal > 0 ? (
        <div className="mt-5 sm:hidden">
          <div className="flex h-2.5 overflow-hidden rounded-full">
            {mobileBuckets.map((series) => (
              <div
                key={series.id}
                style={{
                  width: `${(Math.max(series.balanceUsd, 0) / mobileBucketTotal) * 100}%`,
                  background: BUCKET_COLOR[series.id] ?? "#D5DCE3",
                }}
              />
            ))}
          </div>
          <div className="mt-3">
            {mobileBuckets.map((series) => {
              const earned = earnedCaption(series);
              return (
              <div
                key={series.id}
                className="flex items-center gap-2 border-b border-border/50 py-3 last:border-b-0"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: BUCKET_COLOR[series.id] ?? "#D5DCE3" }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{series.label}</span>
                    {showsBucketRate(series) ? (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {series.apyPercent!.toFixed(2)}%
                      </span>
                    ) : null}
                  </div>
                  {earned ? (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {earned}
                    </p>
                  ) : null}
                </div>
                <span className="ml-auto text-sm font-semibold tabular-nums">
                  {formatUsdAmount(Math.max(series.balanceUsd, 0))}
                </span>
              </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default SavingsPositionCard;
