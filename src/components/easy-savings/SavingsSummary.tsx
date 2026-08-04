import { formatUsdAmount } from "@/lib/utils";
import type { EasySavingsQuote } from "@/hooks/useEasySavingsQuote";
import type { SavingsRoute } from "@/types/easySavings";

type SavingsSummaryProps = {
  route: SavingsRoute;
  amount: string;
  quote: EasySavingsQuote;
};

function formatAmt(n: string, symbol: string): string {
  const v = parseFloat(n);
  if (!Number.isFinite(v) || v <= 0) return `— ${symbol}`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
}

const SavingsSummary = ({ route, amount, quote }: SavingsSummaryProps) => {
  const rows: Array<{ label: string; value: string }> = [
    {
      label: "You supply",
      value: `${formatAmt(amount, route.asset.symbol)} · ${
        quote.amountUsd > 0 ? formatUsdAmount(quote.amountUsd) : "—"
      }`,
    },
    {
      label: "Supply APY",
      value:
        quote.supplyApyPercent != null
          ? `${quote.supplyApyPercent.toFixed(2)}%`
          : "—",
    },
    {
      label: "Your position",
      value:
        quote.existingDeposit != null && quote.existingDeposit > 0
          ? `${quote.existingDeposit.toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })} ${route.asset.symbol} · ${formatUsdAmount(quote.existingDepositUsd)}`
          : "None yet",
    },
    {
      label: "Market",
      value: `${route.marketLabel} · ${route.asset.symbol}`,
    },
    {
      label: "Remaining supply cap",
      value:
        quote.remainingSupplyCap != null
          ? `${quote.remainingSupplyCap.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })} ${route.asset.symbol}`
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

export default SavingsSummary;
