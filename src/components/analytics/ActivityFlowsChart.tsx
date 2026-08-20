import React, { useEffect, useMemo, useState } from "react";
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
import { dorkfiAPIService } from "@/services/dorkfiAPIService";
import { fetchAnalyticsMarketUsdLookup } from "@/services/analyticsProtocolTvl";
import {
  activityRowToUsd,
  analyticsValueToUsd,
  pickWithdrawValueUsd,
} from "@/utils/analyticsActivityUsd";
import {
  aggregateEventsByDay,
  mergeDailyFlows,
  symmetricYDomain,
  type FlowDataPoint,
} from "@/utils/analyticsActivityFlows";
import { formatCurrency, formatChartDate } from "@/utils/analyticsUtils";
import { useTheme } from "next-themes";

type TimePeriod = "7d" | "30d" | "90d";
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
  const [flowData, setFlowData] = useState<FlowDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("90d");

  useEffect(() => {
    let cancelled = false;

    const fetchFlowData = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const days =
          timePeriod === "7d" ? 7 : timePeriod === "30d" ? 30 : 90;
        const startTime = now - days * 24 * 60 * 60 * 1000;

        if (mode === "liquidity") {
          const [depositsResponse, withdrawalsResponse, marketUsdLookup] =
            await Promise.all([
              dorkfiAPIService.getDeposits(startTime, now, 10000),
              dorkfiAPIService.getWithdrawals(startTime, now, 10000),
              fetchAnalyticsMarketUsdLookup().catch((error) => {
                console.warn("Flow chart market USD lookup failed", error);
                return new Map();
              }),
            ]);

          if (cancelled) return;

          const deposits =
            depositsResponse.success && depositsResponse.data?.deposits
              ? depositsResponse.data.deposits
              : [];
          const withdrawals =
            withdrawalsResponse.success &&
            withdrawalsResponse.data?.withdrawals
              ? withdrawalsResponse.data.withdrawals
              : [];

          const inflowByDay = aggregateEventsByDay(deposits, (deposit) =>
            analyticsValueToUsd(deposit.depositValueUSD, deposit.amount)
          );
          const outflowByDay = aggregateEventsByDay(withdrawals, (withdrawal) =>
            activityRowToUsd(
              {
                amount: withdrawal.amount,
                valueUsd: pickWithdrawValueUsd(withdrawal),
                network: withdrawal.network,
                marketId: withdrawal.marketId,
              },
              marketUsdLookup
            )
          );

          setFlowData(mergeDailyFlows(inflowByDay, outflowByDay));
          return;
        }

        const [borrowsResponse, repaysResponse] = await Promise.all([
          dorkfiAPIService.getBorrows(startTime, now, 10000),
          dorkfiAPIService.getRepays(startTime, now, 10000),
        ]);

        if (cancelled) return;

        const borrows =
          borrowsResponse.success && borrowsResponse.data?.borrows
            ? borrowsResponse.data.borrows
            : [];
        const repays =
          repaysResponse.success && repaysResponse.data?.repays
            ? repaysResponse.data.repays
            : [];

        const inflowByDay = aggregateEventsByDay(borrows, (borrow) =>
          analyticsValueToUsd(borrow.borrowValueUSD, borrow.amount)
        );
        const outflowByDay = aggregateEventsByDay(repays, (repay) =>
          analyticsValueToUsd(repay.repayValueUSD, repay.amount)
        );

        setFlowData(mergeDailyFlows(inflowByDay, outflowByDay));
      } catch (error) {
        console.error(`Error fetching ${mode} flow data:`, error);
        if (!cancelled) setFlowData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFlowData();

    return () => {
      cancelled = true;
    };
  }, [mode, timePeriod]);

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
          onValueChange={(value) => value && setTimePeriod(value as TimePeriod)}
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
