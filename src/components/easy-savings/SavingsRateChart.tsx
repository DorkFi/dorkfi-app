import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SavingsRatePoint = {
  date: string;
  rate: number;
};

type SavingsRateChartProps = {
  data: SavingsRatePoint[];
  /** Upper bound for Y axis (percent). */
  yMax?: number;
};

const SavingsRateChart = ({ data, yMax }: SavingsRateChartProps) => {
  const maxRate = Math.max(...data.map((d) => d.rate), 0);
  const domainMax = yMax ?? Math.max(4, Math.ceil(maxRate));
  const ticks = Array.from({ length: domainMax + 1 }, (_, i) => i);
  const xTicks = data
    .filter((d) => d.date === "June" || d.date === "July")
    .map((d) => d.date);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="savingsRateFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="hsl(var(--border))"
            strokeDasharray="4 6"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            ticks={xTicks.length > 0 ? xTicks : undefined}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            domain={[0, domainMax]}
            ticks={ticks}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(value: number) => `${value}%`}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              fontSize: 12,
            }}
            formatter={(value: number) => [
              `${value.toFixed(2)}%`,
              "Savings rate",
            ]}
          />
          <Area
            type="stepAfter"
            dataKey="rate"
            stroke="#34d399"
            strokeWidth={2}
            fill="url(#savingsRateFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Placeholder history anchored to the live APY until on-chain history exists. */
export function buildSavingsRateHistory(
  currentApy: number | null
): SavingsRatePoint[] {
  const rate = currentApy != null && Number.isFinite(currentApy) ? currentApy : 0;
  const prior = Math.max(0, rate - 0.1);
  return [
    { date: "May 1", rate: prior },
    { date: "May 12", rate: prior },
    { date: "May 24", rate: prior },
    { date: "June", rate: prior },
    { date: "June 14", rate: prior },
    { date: "June 26", rate: prior },
    { date: "July", rate: prior },
    { date: "July 12", rate: prior },
    { date: "July 24", rate },
    { date: "Today", rate },
  ];
}

export default SavingsRateChart;
