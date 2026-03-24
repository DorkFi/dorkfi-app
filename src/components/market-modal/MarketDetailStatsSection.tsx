import React, { useMemo } from "react";
import { getMarketLabel } from "@/config";

function formatUsdFromMicro(micro: number): string {
  if (!Number.isFinite(micro)) return "—";
  const usd = micro / 1_000_000;
  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatNumber(n: number, maxFrac = 4): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: maxFrac,
  });
}

export interface MarketDetailStatsSectionProps {
  rawMarket: Record<string, unknown>;
  networkId: string;
}

/**
 * Read-only technical stats for the selected lending market (pool id, caps, risk params).
 */
export const MarketDetailStatsSection: React.FC<MarketDetailStatsSectionProps> = ({
  rawMarket,
  networkId,
}) => {
  const poolId = useMemo(() => {
    const direct = rawMarket.poolId;
    if (direct != null && String(direct) !== "") return String(direct);
    const mi = rawMarket.marketInfo as { poolId?: string } | undefined;
    return mi?.poolId != null ? String(mi.poolId) : "—";
  }, [rawMarket]);

  const marketLabel = useMemo(
    () => getMarketLabel(networkId, poolId !== "—" ? poolId : undefined),
    [networkId, poolId]
  );

  const collateralFactor = Number(rawMarket.collateralFactor ?? 0);
  const liqThreshold = Number(rawMarket.liquidationThreshold ?? 0);
  const liqPenalty = Number(rawMarket.liquidationPenalty ?? 0);
  const reserveFactor = Number(rawMarket.reserveFactor ?? 0);
  const utilization = Number(rawMarket.utilization ?? 0);

  const totalSupplyUSD = Number(rawMarket.totalSupplyUSD ?? 0);
  const totalBorrowUSD = Number(rawMarket.totalBorrowUSD ?? 0);
  const totalSupply = Number(rawMarket.totalSupply ?? 0);
  const totalBorrow = Number(rawMarket.totalBorrow ?? 0);
  const supplyCap = Number(rawMarket.supplyCap ?? 0);
  const borrowCap = Number(rawMarket.borrowCap ?? 0);
  const asset = String(rawMarket.asset ?? "—");

  const isLoading = rawMarket.isLoading === true;
  const error = typeof rawMarket.error === "string" ? rawMarket.error : null;

  const rows: { label: string; value: string; hint?: string }[] = [
    { label: "Network", value: networkId.replace(/-/g, " ") },
    { label: "Lending pool (app)", value: poolId },
    ...(marketLabel
      ? [{ label: "Market", value: `Pool ${marketLabel}` }]
      : []),
    {
      label: "Total supplied",
      value: formatUsdFromMicro(totalSupplyUSD),
      hint: `${formatNumber(totalSupply)} ${asset}`,
    },
    {
      label: "Total borrowed",
      value: formatUsdFromMicro(totalBorrowUSD),
      hint: `${formatNumber(totalBorrow)} ${asset}`,
    },
    {
      label: "Utilization",
      value: `${utilization.toFixed(1)}%`,
    },
    {
      label: "Collateral factor",
      value: `${collateralFactor.toFixed(0)}%`,
    },
    {
      label: "Liquidation threshold",
      value: `${liqThreshold.toFixed(0)}%`,
    },
    {
      label: "Liquidation penalty",
      value: `${liqPenalty.toFixed(0)}%`,
    },
    {
      label: "Reserve factor",
      value: `${reserveFactor.toFixed(0)}%`,
    },
    {
      label: "Supply cap (units)",
      value: supplyCap > 0 ? formatNumber(supplyCap) : "—",
    },
    {
      label: "Borrow cap (units)",
      value: borrowCap > 0 ? formatNumber(borrowCap) : "—",
    },
  ];

  return (
    <div className="rounded-lg border-0 bg-transparent p-0 min-w-0 w-full max-w-full overflow-x-hidden">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-ocean-teal" />
        Market details
      </h3>
      {isLoading && (
        <p className="text-xs text-muted-foreground mb-2">Loading latest market data…</p>
      )}
      {error && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{error}</p>
      )}
      <dl className="space-y-2.5">
        {rows.map(({ label, value, hint }) => (
          <div
            key={label}
            className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 border-b border-border pb-2 last:border-0 last:pb-0"
          >
            <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
            <dd className="text-sm font-medium text-foreground text-right sm:text-right min-w-0 break-all">
              {value}
              {hint && (
                <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
                  {hint}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
