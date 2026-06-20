import { useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  TrendingDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import type { MarketFilter } from "@/hooks/useOnDemandMarketData";
import {
  portfolioMarketFilterLabel,
  portfolioNetworkFilterLabel,
  type PortfolioNetworkFilterValue,
} from "@/utils/portfolioMarketFilter";
import type {
  PortfolioBorrowSummary,
  PortfolioPoolBreakdownRow,
} from "@/components/portfolio/portfolioPoolBreakdownTypes";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

const CHART_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#14b8a6",
];

type PortfolioNetworkBreakdownModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pools: PortfolioPoolBreakdownRow[];
  networkFilter: PortfolioNetworkFilterValue;
  marketFilter: MarketFilter;
  borrows: PortfolioBorrowSummary[];
  healthFactor: number | null;
  displayHealthFactor: number | null;
  totalBorrowed: number;
  isMobile: boolean;
};

const PortfolioNetworkBreakdownModal = ({
  open,
  onOpenChange,
  pools,
  networkFilter,
  marketFilter,
  borrows,
  healthFactor,
  displayHealthFactor,
  totalBorrowed,
  isMobile,
}: PortfolioNetworkBreakdownModalProps) => {
  const { formatNumber, formatCurrency, formatPercent } = useNumberI18n();

  const allocationData = useMemo(
    () =>
      pools
        .map((row) => ({
          name: row.chartLabel,
          value: row.collateral,
          poolKey: row.poolKey,
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [pools]
  );

  const totalAllocation = allocationData.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const topBorrowedAsset =
    borrows.length > 0
      ? borrows.reduce((top, current) =>
          current.value > (top?.value || 0) ? current : top
        )
      : null;

  const topBorrowedPercentage =
    topBorrowedAsset && totalBorrowed > 0
      ? (topBorrowedAsset.value / totalBorrowed) * 100
      : 0;

  const closestToLiquidation =
    borrows.length > 0 && healthFactor !== null && healthFactor < 2.0
      ? { asset: "Portfolio", healthFactor }
      : null;

  const poolMargins = pools.map((row) => row.liquidationMargin);
  const lowestLiquidationMargin =
    poolMargins.length > 0 ? Math.min(...poolMargins) : null;

  const activeFilterLabels = [
    networkFilter !== "all"
      ? portfolioNetworkFilterLabel(networkFilter)
      : null,
    marketFilter !== "all" ? portfolioMarketFilterLabel(marketFilter) : null,
  ].filter(Boolean);

  const filterNote =
    activeFilterLabels.length === 0
      ? "Showing all networks and markets. Change filters in Positions to narrow this view."
      : `Filtered to ${activeFilterLabels.join(" · ")}. Change filters in Positions to adjust.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,880px)] w-full max-w-[min(100vw-1.5rem,56rem)] flex-col overflow-hidden border border-gray-200/50 bg-gradient-to-br from-blue-50 to-cyan-50 p-0 shadow-xl dark:border-ocean-teal/20 dark:from-slate-900 dark:to-slate-800 sm:max-w-3xl">
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-gray-200/50 px-6 pb-4 pt-6 text-left dark:border-ocean-teal/20 sm:px-8">
          <DialogTitle className="text-left text-xl sm:text-2xl">
            Network portfolio
          </DialogTitle>
          <DialogDescription className="text-left text-sm">
            Per-pool on-chain totals. {filterNote}
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 sm:px-8">
            <div className="mb-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
              <DorkFiCard className="p-4 sm:p-5">
                <h3 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">
                  Collateral allocation
                </h3>
                {totalAllocation > 0 && allocationData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer
                      width="100%"
                      height={isMobile ? 200 : 250}
                    >
                      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Pie
                          data={allocationData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {allocationData.map((entry, index) => (
                            <Cell
                              key={entry.poolKey ?? `cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number) => [
                            formatCurrency(value, "USD", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }),
                            "Collateral",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 w-full space-y-2">
                      {allocationData.map((item, index) => (
                        <div
                          key={item.poolKey ?? index}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{
                                backgroundColor:
                                  CHART_COLORS[index % CHART_COLORS.length],
                              }}
                            />
                            <span className="text-muted-foreground">
                              {item.name}
                            </span>
                          </div>
                          <span className="font-semibold">
                            {formatPercent(item.value / totalAllocation, {
                              maximumFractionDigits: 1,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center text-muted-foreground">
                    <p>No collateral data available</p>
                  </div>
                )}
              </DorkFiCard>

              <div className="space-y-4">
                <h3 className="mb-4 text-lg font-semibold">Risk overview</h3>

                {lowestLiquidationMargin !== null ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DorkFiCard className="cursor-help border-l-4 border-orange-500 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 text-orange-500" />
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-1 text-sm font-semibold text-orange-600 dark:text-orange-400">
                              Lowest liquidation margin
                              <Info className="h-3 w-3" />
                            </div>
                            <div className="text-base font-bold">
                              {formatPercent(lowestLiquidationMargin / 100, {
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {networkFilter === "all"
                                ? "Lowest among pools shown (all networks)"
                                : "Lowest among pools on this network"}
                            </div>
                          </div>
                        </div>
                      </DorkFiCard>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="mb-1 font-semibold">Liquidation margin</p>
                      <p className="text-sm">
                        The safety buffer before liquidation. Keep this above
                        10–15% for safety.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}

                {topBorrowedAsset && topBorrowedPercentage > 0 ? (
                  <DorkFiCard className="border-l-4 border-amber-500 p-4">
                    <div className="flex items-start gap-3">
                      <TrendingDown className="mt-0.5 h-5 w-5 text-amber-500" />
                      <div className="flex-1">
                        <div className="mb-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
                          Top borrowed asset
                        </div>
                        <div className="text-base font-bold">
                          {topBorrowedAsset.asset}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {formatPercent(topBorrowedPercentage / 100, {
                            maximumFractionDigits: 1,
                          })}{" "}
                          of total borrows
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          $
                          {formatNumber(topBorrowedAsset.value, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>
                  </DorkFiCard>
                ) : null}

                {closestToLiquidation ? (
                  <DorkFiCard className="border-l-4 border-red-500 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
                      <div className="flex-1">
                        <div className="mb-1 text-sm font-semibold text-red-600 dark:text-red-400">
                          Closest to liquidation
                        </div>
                        <div className="text-base font-bold">
                          {closestToLiquidation.asset}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Health factor:{" "}
                          <span
                            className={`font-semibold ${
                              closestToLiquidation.healthFactor >= 1.5
                                ? "text-green-600 dark:text-green-400"
                                : closestToLiquidation.healthFactor >= 1.0
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatNumber(closestToLiquidation.healthFactor, {
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        {closestToLiquidation.healthFactor < 1.5 ? (
                          <div className="mt-1 text-xs text-red-500">
                            Consider adding collateral or repaying debt
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </DorkFiCard>
                ) : null}

                {healthFactor !== null ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DorkFiCard className="cursor-help border-l-4 border-ocean-teal p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 text-ocean-teal" />
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-1 text-sm font-semibold text-ocean-teal">
                              Portfolio risk score
                              <Info className="h-3 w-3" />
                            </div>
                            <div className="mt-2 flex items-center gap-3">
                              <div className="flex-1">
                                <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                                  <div
                                    className={`h-2.5 rounded-full transition-all ${
                                      healthFactor >= 2.0
                                        ? "bg-green-500"
                                        : healthFactor >= 1.5
                                          ? "bg-yellow-500"
                                          : healthFactor >= 1.0
                                            ? "bg-orange-500"
                                            : "bg-red-500"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        ((displayHealthFactor || 0) / 3.0) *
                                          100,
                                        100
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="text-sm font-semibold">
                                {displayHealthFactor !== null
                                  ? formatNumber(displayHealthFactor, {
                                      maximumFractionDigits: 2,
                                    })
                                  : "N/A"}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {healthFactor >= 2.0
                                ? "Low risk"
                                : healthFactor >= 1.5
                                  ? "Moderate risk"
                                  : healthFactor >= 1.0
                                    ? "High risk"
                                    : "Critical risk"}
                            </div>
                          </div>
                        </div>
                      </DorkFiCard>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="mb-1 font-semibold">Health factor</p>
                      <p className="text-sm">
                        Measures portfolio safety: (collateral × collateral
                        factor) / total borrowed.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}

                {!topBorrowedAsset &&
                !closestToLiquidation &&
                healthFactor === null ? (
                  <DorkFiCard className="p-4">
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm">No risk data available</p>
                    </div>
                  </DorkFiCard>
                ) : null}
              </div>
            </div>

            {pools.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>No lending pools found for the selected filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pools.map((row) => (
                  <DorkFiCard
                    key={row.poolKey}
                    className="border-2 p-4 transition-all hover:border-ocean-teal/50 sm:p-5"
                  >
                    <div className="space-y-4">
                      <div>
                        <h3 className="mb-1 text-lg font-semibold">
                          {row.title}
                        </h3>
                        <p className="break-all font-mono text-xs text-muted-foreground">
                          Pool {row.poolId}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">
                            Collateral:
                          </span>
                          <span className="text-right text-sm font-semibold tabular-nums">
                            {formatCurrency(row.collateral, "USD", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">
                            Borrowed:
                          </span>
                          <span className="text-right text-sm font-semibold tabular-nums">
                            {formatCurrency(row.borrow, "USD", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">
                            Net value:
                          </span>
                          <span
                            className={`text-right text-sm font-semibold tabular-nums ${
                              row.netValue >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatCurrency(row.netValue, "USD", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div className="space-y-2 border-t border-border pt-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-muted-foreground">
                              Health factor:
                            </span>
                            <span
                              className={`text-sm font-semibold tabular-nums ${
                                row.healthFactor === null
                                  ? "text-muted-foreground"
                                  : row.healthFactor >= 1.5
                                    ? "text-green-600 dark:text-green-400"
                                    : row.healthFactor >= 1.0
                                      ? "text-yellow-600 dark:text-yellow-400"
                                      : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {row.healthFactor === null
                                ? "N/A"
                                : formatNumber(row.healthFactor, {
                                    maximumFractionDigits: 2,
                                  })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-muted-foreground">
                              Liquidation margin:
                            </span>
                            <span
                              className={`text-sm font-semibold tabular-nums ${
                                row.liquidationMargin >= 20
                                  ? "text-green-600 dark:text-green-400"
                                  : row.liquidationMargin >= 10
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : row.liquidationMargin >= 0
                                      ? "text-orange-600 dark:text-orange-400"
                                      : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {formatPercent(row.liquidationMargin / 100, {
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DorkFiCard>
                ))}
              </div>
            )}
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
};

export default PortfolioNetworkBreakdownModal;
