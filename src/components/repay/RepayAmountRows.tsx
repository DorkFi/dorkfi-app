import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { LocaleNumberInput } from "@/components/ui/LocaleNumberInput";
import { cn } from "@/lib/utils";

export type RepayAmountSide = {
  label: string;
  symbol: string;
  iconSrc?: string;
  /** Amount rendered when this side is the derived one; null when unavailable. */
  derivedAmount?: string | null;
  usdValue?: number | null;
  /** Secondary line, e.g. wallet balance or total owed. */
  footnote?: ReactNode;
  warning?: ReactNode;
};

export type RepayAmountRowsProps = {
  /** Row the user types into; the other row is derived from it. */
  editableSide: "pay" | "debt";
  amount: number | "";
  onAmountChange: (value: number | "") => void;
  /** Asset spent from the wallet. */
  pay: RepayAmountSide;
  /** Market debt being cleared. */
  debt: RepayAmountSide;
  /** Derived row shows `derivedPendingLabel` instead of an amount. */
  derivedPending?: boolean;
  derivedPendingLabel?: string;
  /** MAX / route controls, rendered beside the editable row's footnote. */
  editableActions?: ReactNode;
  formatUsd: (usd: number) => string;
  inputId?: string;
  autoFocus?: boolean;
};

/**
 * Debt row over pay row for repayment. Both units are always named so the
 * amount field can never be read as the other asset; whichever row the active
 * route denominates its amount in is the editable one.
 */
export function RepayAmountRows({
  editableSide,
  amount,
  onAmountChange,
  pay,
  debt,
  derivedPending = false,
  derivedPendingLabel = "Quoting…",
  editableActions,
  formatUsd,
  inputId = "amount",
  autoFocus,
}: RepayAmountRowsProps) {
  const renderRow = (side: RepayAmountSide, which: "pay" | "debt") => {
    const isEditable = which === editableSide;
    const usd =
      side.usdValue != null && side.usdValue > 0
        ? `$${formatUsd(side.usdValue)}`
        : null;

    return (
      <div
        className={cn(
          "rounded-lg border p-3",
          isEditable
            ? "border-ocean-teal/60 bg-white/80 dark:border-ocean-teal/50 dark:bg-slate-800"
            : "border-gray-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40"
        )}
      >
        {isEditable ? (
          <Label
            htmlFor={inputId}
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {side.label}
          </Label>
        ) : (
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {side.label}
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isEditable ? (
              <LocaleNumberInput
                id={inputId}
                placeholder="0.0"
                autoFocus={autoFocus}
                value={amount}
                onChange={(v) => onAmountChange(v ?? "")}
                formatOptions={{ maximumFractionDigits: 6 }}
                className="h-auto border-0 bg-transparent p-0 text-2xl font-semibold text-slate-800 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white"
              />
            ) : (
              <p className="truncate text-2xl font-semibold text-slate-500 dark:text-slate-400">
                {derivedPending
                  ? derivedPendingLabel
                  : side.derivedAmount != null
                    ? `≈ ${side.derivedAmount}`
                    : "—"}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2.5 dark:bg-slate-700/60">
            {side.iconSrc && (
              <img
                src={side.iconSrc}
                alt={side.symbol}
                className="h-6 w-6 rounded-full"
              />
            )}
            <span
              className={cn(
                "text-sm font-semibold text-slate-800 dark:text-slate-100",
                !side.iconSrc && "pl-1.5"
              )}
            >
              {side.symbol}
            </span>
          </div>
        </div>

        <div className="mt-1 flex items-end justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {usd ?? ""}
          </span>
          <span className="flex items-center gap-2 text-right text-xs text-slate-500 dark:text-slate-400">
            {side.footnote}
            {isEditable && editableActions}
          </span>
        </div>

        {side.warning && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            {side.warning}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {renderRow(debt, "debt")}
      {renderRow(pay, "pay")}
    </div>
  );
}
