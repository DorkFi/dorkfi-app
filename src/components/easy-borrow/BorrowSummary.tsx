import { formatUsdAmount } from "@/lib/utils";
import type { EasyBorrowQuote } from "@/hooks/useEasyBorrowQuote";
import type { BorrowRoute } from "@/types/easyBorrow";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { consumerAssetDisplayLabel } from "@/services/savingsRouteResolver";

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
  const consumerCopy = useConsumerCopy();
  const collateralSymbol = consumerCopy
    ? consumerAssetDisplayLabel(route.collateral.symbol)
    : route.collateral.symbol;
  const borrowSymbol = consumerCopy
    ? consumerAssetDisplayLabel(route.borrow.symbol)
    : route.borrow.symbol;
  const rows: Array<{ label: string; value: string }> = [
    {
      label: consumerCopy ? "Savings backing this loan" : "Collateral",
      value: `${formatAmt(collateralAmount, collateralSymbol)} · ${
        quote.collateralUsd > 0 ? formatUsdAmount(quote.collateralUsd) : "—"
      }`,
    },
    {
      label: "You borrow",
      value: `${formatAmt(borrowAmount, borrowSymbol)} · ${
        quote.borrowUsd > 0 ? formatUsdAmount(quote.borrowUsd) : "—"
      }`,
    },
    {
      label: consumerCopy ? "Borrow rate" : "Borrow APR",
      value:
        quote.borrowAprPercent != null
          ? `${quote.borrowAprPercent.toFixed(2)}%`
          : "—",
    },
  ];
  if (!consumerCopy) {
    rows.push(
      {
        label: "Liquidation price",
        value:
          quote.liquidationPrice != null
            ? `${formatUsdAmount(quote.liquidationPrice)} / ${collateralSymbol}`
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
      }
    );
  } else {
    rows.push({
      label: "Loan safety",
      value:
        quote.healthAfter != null
          ? quote.healthAfter >= 1.2
            ? "Healthy"
            : quote.healthAfter >= 1.05
              ? "Caution"
              : "At risk"
          : "—",
    });
  }

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
