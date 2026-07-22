import { useMemo } from "react";
import BigNumber from "bignumber.js";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { HaystackPaymentAssetOption } from "@/utils/haystackAsaIds";
import type { HaystackQuoteResponse } from "@/services/haystackRouterService";
import {
  decodeHaystackPaymentSelectValue,
  encodeHaystackPaymentSelectValue,
} from "@/utils/haystackPaymentSelect";

type Props = {
  paymentAssets: HaystackPaymentAssetOption[];
  selectedPaymentAsaId: number | null;
  onSelectPaymentAsaId: (asaId: number | null) => void;
  debtSymbol: string;
  quote: HaystackQuoteResponse | null;
  paymentAtomicNeeded: bigint | null;
  paymentDecimals: number;
  isLoading: boolean;
  error: string | null;
  slippagePercent: number;
  onSlippageChange: (pct: number) => void;
};

function formatAtomic(atomic: bigint, decimals: number): string {
  try {
    const v = new BigNumber(atomic.toString()).shiftedBy(-decimals);
    return v.decimalPlaces(Math.min(6, decimals), BigNumber.ROUND_UP).toFixed();
  } catch {
    return "—";
  }
}

/**
 * Cross-asset “Repay with” controls for Haystack-routed repayment.
 */
export function CrossAssetRepaySection({
  paymentAssets,
  selectedPaymentAsaId,
  onSelectPaymentAsaId,
  debtSymbol,
  quote,
  paymentAtomicNeeded,
  paymentDecimals,
  isLoading,
  error,
  slippagePercent,
  onSlippageChange,
}: Props) {
  const selected = useMemo(
    () => paymentAssets.find((a) => a.asaId === selectedPaymentAsaId) ?? null,
    [paymentAssets, selectedPaymentAsaId]
  );

  const selectValue = encodeHaystackPaymentSelectValue(selectedPaymentAsaId);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200/80 bg-white/60 p-3 dark:border-slate-600 dark:bg-slate-800/60">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Repay with
        </Label>
        <select
          className="h-8 rounded-md border border-gray-200 bg-white/90 px-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          value={String(slippagePercent)}
          onChange={(e) => onSlippageChange(Number(e.target.value))}
          aria-label="Swap slippage"
        >
          <option value={0.5}>0.5% slip</option>
          <option value={1}>1% slip</option>
          <option value={2}>2% slip</option>
        </select>
      </div>

      <Select
        value={selectValue}
        onValueChange={(v) => {
          onSelectPaymentAsaId(decodeHaystackPaymentSelectValue(v));
        }}
      >
        <SelectTrigger className="h-10 bg-white/90 dark:bg-slate-800/80">
          <SelectValue placeholder="Select asset" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={encodeHaystackPaymentSelectValue(null)}>
            {debtSymbol} (same asset)
          </SelectItem>
          {paymentAssets.map((a) => (
            <SelectItem
              key={a.asaId}
              value={encodeHaystackPaymentSelectValue(a.asaId)}
            >
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPaymentAsaId != null && (
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {isLoading && (
            <p className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Fetching Haystack quote…
            </p>
          )}
          {error && (
            <p className="text-amber-600 dark:text-amber-400">{error}</p>
          )}
          {!isLoading && !error && quote && paymentAtomicNeeded != null && (
            <>
              <p>
                You pay ≈{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {formatAtomic(paymentAtomicNeeded, paymentDecimals)}{" "}
                  {selected?.symbol ?? "asset"}
                </span>{" "}
                (swapped to {debtSymbol}, then repaid — not your wallet{" "}
                {debtSymbol})
              </p>
              {quote.usdIn != null && quote.usdOut != null && (
                <p className="text-slate-500 dark:text-slate-400">
                  ~${quote.usdIn.toFixed(2)} → ~${quote.usdOut.toFixed(2)}
                  {quote.userPriceImpact != null
                    ? ` · impact ${quote.userPriceImpact.toFixed(2)}%`
                    : ""}
                </p>
              )}
              <div
                className="mt-2 rounded-md border border-amber-200/90 bg-amber-50/90 px-2.5 py-2 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100"
                role="status"
              >
                <p className="font-medium text-[11px] uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
                  2 wallet signatures required
                </p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] leading-snug text-amber-950/90 dark:text-amber-50/90">
                  <li>
                    Swap {selected?.symbol ?? "payment asset"} → {debtSymbol}
                  </li>
                  <li>Repay your {debtSymbol} debt</li>
                </ol>
              </div>
            </>
          )}
          {!isLoading && !error && selectedPaymentAsaId === 0 && !quote && (
            <p className="text-slate-500 dark:text-slate-400">
              Selected ALGO — waiting for Haystack route to {debtSymbol}…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
