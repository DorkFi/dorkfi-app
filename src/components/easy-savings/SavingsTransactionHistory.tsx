import { ExternalLink } from "lucide-react";
import type { NetworkId } from "@/config";
import type { SavingsTxRecord } from "@/services/savingsTransactionHistory";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";
import { cn } from "@/lib/utils";

type SavingsTransactionHistoryProps = {
  networkId: NetworkId;
  items: SavingsTxRecord[];
  isLoading?: boolean;
  className?: string;
};

function kindLabel(kind: SavingsTxRecord["kind"]): string {
  switch (kind) {
    case "deposit":
      return "Deposit";
    case "withdraw":
      return "Withdraw";
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

function shortTx(txId: string): string {
  if (txId.length <= 12) return txId;
  return `${txId.slice(0, 6)}…${txId.slice(-4)}`;
}

const SavingsTransactionHistory = ({
  networkId,
  items,
  isLoading,
  className,
}: SavingsTransactionHistoryProps) => {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-border/60 bg-card p-5 sm:p-6 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Transaction history
        </h2>
        {isLoading ? (
          <span className="text-xs text-muted-foreground">Updating…</span>
        ) : null}
      </div>

      {items.length === 0 && !isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No transactions yet. Deposits and withdrawals will show up here.
        </p>
      ) : null}

      {items.length === 0 && isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading history…</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-5 divide-y divide-border/60">
          {items.map((item) => {
            const url = getExplorerTransactionUrl(networkId, item.txId);
            const amountText =
              item.amount && item.symbol
                ? `${item.amount} ${item.symbol}`
                : item.amount
                  ? item.amount
                  : null;
            const isIn = item.kind === "deposit";
            const isOut = item.kind === "withdraw";

            return (
              <li
                key={item.txId}
                className="flex items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isIn && "text-ocean-teal",
                        isOut && "text-orange-600 dark:text-orange-400"
                      )}
                    >
                      {kindLabel(item.kind)}
                    </span>
                    {amountText ? (
                      <span className="text-sm tabular-nums font-medium">
                        {isOut ? "−" : isIn ? "+" : ""}
                        {amountText}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatWhen(item.timestamp)}
                  </p>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  title="View on explorer"
                >
                  <span className="font-mono">{shortTx(item.txId)}</span>
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
};

export default SavingsTransactionHistory;
