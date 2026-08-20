import { ExternalLink } from "lucide-react";
import type { NetworkId } from "@/config";
import type { BorrowTxRecord } from "@/services/borrowTransactionHistory";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import { cn } from "@/lib/utils";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { consumerAssetDisplayLabel } from "@/services/savingsRouteResolver";

type BorrowTransactionHistoryProps = {
  networkId: NetworkId;
  items: BorrowTxRecord[];
  isLoading?: boolean;
};

function kindLabel(kind: BorrowTxRecord["kind"]): string {
  switch (kind) {
    case "borrow":
      return "Borrow";
    case "repay":
      return "Repay";
    case "supply":
      return "Deposit";
    default:
      return "Activity";
  }
}

function formatWhen(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function shortTx(txId: string): string {
  if (txId.length <= 12) return txId;
  return `${txId.slice(0, 6)}…${txId.slice(-4)}`;
}

const BorrowTransactionHistory = ({
  networkId,
  items,
  isLoading,
}: BorrowTransactionHistoryProps) => {
  const consumerCopy = useConsumerCopy();
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground">
          {consumerCopy ? "Activity" : "Transaction history"}
        </p>
        {isLoading ? (
          <span className="text-muted-foreground">Updating…</span>
        ) : null}
      </div>

      {items.length === 0 && !isLoading ? (
        <p className="mt-2 text-muted-foreground">
          {consumerCopy
            ? "No borrow activity yet."
            : "No borrow transactions yet."}
        </p>
      ) : null}

      {items.length === 0 && isLoading ? (
        <p className="mt-2 text-muted-foreground">Loading history…</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-2 divide-y divide-border/50">
          {items.slice(0, 15).map((item) => {
            const url = getExplorerTransactionUrl(networkId, item.txId);
            const amountText =
              item.amount && item.symbol
                ? `${item.amount} ${
                    consumerCopy
                      ? consumerAssetDisplayLabel(item.symbol)
                      : item.symbol
                  }`
                : item.amount || null;
            const isBorrow = item.kind === "borrow";
            const isRepay = item.kind === "repay";

            return (
              <li
                key={item.txId}
                className="flex items-start justify-between gap-2 py-2 first:pt-1.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "font-medium",
                        isBorrow && "text-ocean-teal",
                        isRepay && "text-orange-600 dark:text-orange-400"
                      )}
                    >
                      {kindLabel(item.kind)}
                    </span>
                    {amountText ? (
                      <span className="tabular-nums">
                        {isRepay ? "−" : isBorrow ? "+" : ""}
                        {amountText}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {formatWhen(item.timestamp)}
                  </p>
                </div>
                {!consumerCopy ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 shrink-0 font-mono text-muted-foreground hover:text-foreground"
                    title="View on explorer"
                  >
                    {shortTx(item.txId)}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

export default BorrowTransactionHistory;
