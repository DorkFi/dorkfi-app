import { formatUsdAmount } from "@/lib/utils";
import type { EasyBorrowQuote } from "@/hooks/useEasyBorrowQuote";
import type { BorrowRoute } from "@/types/easyBorrow";

type BorrowSummaryProps = {
  route: BorrowRoute;
  collateralAmount: string;
  borrowAmount: string;
  quote: EasyBorrowQuote;
};

function formatAmt(n: string, symbol: string): string {
  const v = parseFloat(n);
  if (!Number.isFinite(v) || v <= 0) return `— ${symbol}`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
}

const BorrowSummary = ({
  route,
  collateralAmount,
  borrowAmount,
  quote,
}: BorrowSummaryProps) => {
  const rows: Array<{ label: string; value: string }> = [
    {
      label: "Collateral",
      value: `${formatAmt(collateralAmount, route.collateral.symbol)} · ${
        quote.collateralUsd > 0 ? formatUsdAmount(quote.collateralUsd) : "—"
      }`,
    },
    {
      label: "You borrow",
      value: `${formatAmt(borrowAmount, route.borrow.symbol)} · ${
        quote.borrowUsd > 0 ? formatUsdAmount(quote.borrowUsd) : "—"
      }`,
    },
    {
      label: "Borrow APR",
      value:
        quote.borrowAprPercent != null
          ? `${quote.borrowAprPercent.toFixed(2)}%`
          : "—",
    },
    {
      label: "Liquidation price",
      value:
        quote.liquidationPrice != null
          ? `${formatUsdAmount(quote.liquidationPrice)} / ${route.collateral.symbol}`
          : "—",
    },
    {
      label: "Portfolio Health",
      value: `${
        quote.healthBefore != null ? quote.healthBefore.toFixed(2) : "—"
      } → ${quote.healthAfter != null ? quote.healthAfter.toFixed(2) : "—"}`,
    },
    {
      label: "Available liquidity",
      value:
        quote.availableLiquidity != null && quote.borrowPrice != null
          ? formatUsdAmount(quote.availableLiquidity * quote.borrowPrice)
          : "—",
    },
  ];

  return (
    <div className="rounded-2xl border border-border/60 divide-y divide-border/50 text-sm">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-start justify-between gap-3 px-4 py-2.5"
        >
          <span className="text-muted-foreground shrink-0">{row.label}</span>
          <span className="font-medium text-right">{row.value}</span>
        </div>
      ))}
    </div>
  );
};

export default BorrowSummary;
