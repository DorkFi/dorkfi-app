import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartCard from "./ChartCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useFlowSeries,
} from "@/hooks/useCachedAnalyticsSeries";
import { symmetricYDomain } from "@/utils/analyticsActivityFlows";
import { formatCurrency, formatChartDate } from "@/utils/analyticsUtils";
import { type AnalyticsTimePeriod } from "@/utils/analyticsTimePeriod";
import { useTheme } from "next-themes";

type FlowMode = "liquidity" | "loans";

interface ActivityFlowsChartProps {
  mode: FlowMode;
}

const FLOW_CONFIG: Record<
  FlowMode,
  {
    title: string;
    tooltip: string;
    inflowLabel: string;
    outflowLabel: string;
    netflowLabel: string;
  }
> = {
  liquidity: {
    title: "Net Liquidity Flows",
    tooltip:
      "Inflows, outflows and net flows of liquidity into the pool. Add = deposits, Withdraw = withdrawals, Supply Netflow = deposits minus withdrawals.",
    inflowLabel: "Add",
    outflowLabel: "Withdraw",
    netflowLabel: "Supply Netflow",
  },
  loans: {
    title: "Net Loans Flows",
    tooltip:
      "Borrow, repay and net debt flows. Borrow = new borrows, Repay = repayments, Debt Netflow = borrows minus repays.",
    inflowLabel: "Borrow",
    outflowLabel: "Repay",
    netflowLabel: "Debt Netflow",
  },
};

const INFLOW_COLOR = "hsl(var(--highlight-aqua))";
const OUTFLOW_COLOR = "hsl(var(--ocean-teal))";
const NETFLOW_COLOR = "rgb(236, 72, 153)";

function formatAxisValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

const ActivityFlowsChart = ({ mode }: ActivityFlowsChartProps) => {
  const { theme } = useTheme();
  const config = FLOW_CONFIG[mode];
  const [timePeriod, setTimePeriod] = useState<AnalyticsTimePeriod>("90d");
  const { series: flowData, loading } = useFlowSeries(mode, timePeriod);

  const chartData = useMemo(
    () =>
      flowData.map((point) => ({
        ...point,
        label: formatChartDate(point.date),
      })),
    [flowData]
  );

  const yAxisDomain = useMemo(
    () => symmetricYDomain(flowData),
    [flowData]
  );

  const netflowTotal = useMemo(
    () => flowData.reduce((sum, point) => sum + point.netflow, 0),
    [flowData]
  );

  const subtitle = loading
    ? "Net flow: Loading..."
    : `Net flow (${timePeriod}): ${formatCurrency(netflowTotal)}`;

  if (loading) {
    return (
      <ChartCard title={config.title} subtitle={subtitle} tooltip={config.tooltip}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={config.title}
      subtitle={subtitle}
      tooltip={config.tooltip}
      controls={
        <ToggleGroup
          type="single"
          value={timePeriod}
          onValueChange={(value) =>
            value && setTimePeriod(value as AnalyticsTimePeriod)
          }
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="7d" aria-label="7 days">
            7d
          </ToggleGroupItem>
          <ToggleGroupItem value="30d" aria-label="30 days">
            30d
          </ToggleGroupItem>
          <ToggleGroupItem value="90d" aria-label="90 days">
            90d
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={
                theme === "dark" ? "rgb(30, 41, 59)" : "rgb(226, 232, 240)"
              }
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatAxisValue}
              domain={yAxisDomain}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: number, name: string) => [
                formatCurrency(Math.abs(value)),
                name,
              ]}
              labelFormatter={(_, payload) => {
                const rawDate = payload?.[0]?.payload?.date;
                return rawDate
                  ? formatChartDate(rawDate, "long")
                  : "Unknown date";
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="inflow"
              name={config.inflowLabel}
              stroke={INFLOW_COLOR}
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="outflow"
              name={config.outflowLabel}
              stroke={OUTFLOW_COLOR}
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="netflow"
              name={config.netflowLabel}
              stroke={NETFLOW_COLOR}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No flow data available for this period.
        </div>
      )}
    </ChartCard>
  );
};

export default ActivityFlowsChart;
