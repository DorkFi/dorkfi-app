import { ExternalLink } from "lucide-react";
import type { NetworkId } from "@/config";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import { cn } from "@/lib/utils";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { consumerAssetDisplayLabel } from "@/services/savingsRouteResolver";

export type PortfolioActivityKind =
  | "deposit"
  | "withdraw"
  | "borrow"
  | "repay"
  | "supply"
  | "activity";

export type PortfolioActivityItem = {
  txId: string;
  kind: PortfolioActivityKind;
  amount?: string;
  symbol?: string;
  timestamp: number;
};

type PortfolioActivityTableProps = {
  networkId: NetworkId;
  items: PortfolioActivityItem[];
  isLoading?: boolean;
};

function kindLabel(
  kind: PortfolioActivityKind,
  consumerCopy: boolean
): string {
  switch (kind) {
    case "deposit":
      return "Deposit";
    case "withdraw":
      return "Withdraw";
    case "borrow":
      return "Borrow";
    case "repay":
      return "Repay";
    case "supply":
      return consumerCopy ? "Deposit" : "Supply";
    default:
      return "Activity";
  }
}

function formatWhen(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function shortTxId(txId: string): string {
  if (txId.length <= 12) return txId;
  return `${txId.slice(0, 6)}…${txId.slice(-4)}`;
}

function assetLabel(item: PortfolioActivityItem, consumerCopy: boolean): string {
  if (!item.symbol) return "—";
  return consumerCopy ? consumerAssetDisplayLabel(item.symbol) : item.symbol;
}

function amountText(
  item: PortfolioActivityItem,
  consumerCopy: boolean
): string | null {
  if (!item.amount) return null;
  if (!item.symbol) return item.amount;
  const symbol = consumerCopy
    ? consumerAssetDisplayLabel(item.symbol)
    : item.symbol;
  return `${item.amount} ${symbol}`;
}

function signedPrefix(kind: PortfolioActivityKind): string {
  if (kind === "withdraw" || kind === "repay") return "−";
  if (kind === "deposit" || kind === "borrow" || kind === "supply") return "+";
  return "";
}

const PortfolioActivityTable = ({
  networkId,
  items,
  isLoading,
}: PortfolioActivityTableProps) => {
  const consumerCopy = useConsumerCopy();

  return (
    <section className="rounded-[24px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {consumerCopy ? "Activity" : "Transaction history"}
        </h2>
        {isLoading ? (
          <span className="text-xs text-muted-foreground">Updating…</span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
          {isLoading
            ? "Loading history…"
            : consumerCopy
              ? "No activity yet. Deposits, withdrawals, borrows, and repayments will show up here."
              : "No transactions yet. Deposits, withdrawals, borrows, and repayments will show up here."}
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Asset</th>
                <th className="pb-3 font-medium">Amount</th>
                <th className="pb-3 font-medium">Date</th>
                {!consumerCopy ? (
                  <th className="pb-3 font-medium text-right">Transaction</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const url = getExplorerTransactionUrl(networkId, item.txId);
                const amount = amountText(item, consumerCopy);
                const isIn =
                  item.kind === "deposit" ||
                  item.kind === "borrow" ||
                  item.kind === "supply";
                const isOut = item.kind === "withdraw" || item.kind === "repay";
                return (
                  <tr
                    key={item.txId}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="py-4">
                      <span
                        className={cn(
                          "font-semibold",
                          isIn && "text-ocean-teal",
                          isOut && "text-orange-600 dark:text-orange-400"
                        )}
                      >
                        {kindLabel(item.kind, consumerCopy)}
                      </span>
                    </td>
                    <td className="py-4 font-medium">
                      {assetLabel(item, consumerCopy)}
                    </td>
                    <td className="py-4 tabular-nums font-medium">
                      {amount ? (
                        <>
                          {signedPrefix(item.kind)}
                          {amount}
                        </>
                      ) : (
                        <span className="text-muted-foreground font-normal">
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-muted-foreground">
                      {formatWhen(item.timestamp)}
                    </td>
                    {!consumerCopy ? (
                      <td className="py-4 text-right">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                          title="View on explorer"
                        >
                          <span className="font-mono">{shortTxId(item.txId)}</span>
                          <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default PortfolioActivityTable;
