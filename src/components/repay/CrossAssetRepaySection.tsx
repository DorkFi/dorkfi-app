import { useMemo } from "react";
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
  debtIcon?: string;
  debtBalance?: number;
  debtUsdPrice?: number;
  paymentBalances: Record<number, number> | null;
  /** USD per token for payment ASAs (asaId → price). */
  paymentUsdPrices: Record<number, number> | null;
  quote: HaystackQuoteResponse | null;
  paymentAtomicNeeded: bigint | null;
  isLoading: boolean;
  error: string | null;
  slippagePercent: number;
  onSlippageChange: (pct: number) => void;
};

function formatDropdownUsd(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  if (usd <= 0) return "$0.00";
  if (usd >= 0.01) {
    return `$${usd.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${usd.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`;
}

function PaymentAssetOptionRow({
  iconSrc,
  title,
  subtitle,
  balance,
  usdValue,
}: {
  iconSrc?: string;
  title: string;
  subtitle: string;
  balance?: number;
  usdValue?: number | null;
}) {
  const balanceLabel =
    balance == null
      ? "—"
      : balance.toLocaleString(undefined, {
          maximumFractionDigits: 6,
        });

  return (
    <span className="flex w-full min-w-0 items-center gap-2.5">
      <span className="flex min-w-0 items-center gap-2.5 text-left">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full"
          />
        ) : (
          <span className="h-8 w-8 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        </span>
      </span>
      <span className="ml-auto shrink-0 pl-3 text-right tabular-nums">
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
          {balanceLabel}
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatDropdownUsd(usdValue)}
        </span>
      </span>
    </span>
  );
}

/**
 * Cross-asset “Repay with” controls for Haystack-routed repayment. The quoted
 * cost and the debt amount are rendered by the pay/debt rows, not here.
 */
export function CrossAssetRepaySection({
  paymentAssets,
  selectedPaymentAsaId,
  onSelectPaymentAsaId,
  debtSymbol,
  debtIcon,
  debtBalance,
  debtUsdPrice,
  paymentBalances,
  paymentUsdPrices,
  quote,
  paymentAtomicNeeded,
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

  const debtUsd =
    debtBalance != null && debtUsdPrice != null && debtUsdPrice > 0
      ? debtBalance * debtUsdPrice
      : debtBalance != null
        ? 0
        : null;

  const sortedPaymentAssets = useMemo(() => {
    if (paymentBalances == null) return [];

    return paymentAssets
      .filter((asset) => (paymentBalances[asset.asaId] ?? 0) > 0)
      .sort((a, b) => {
        const ba = paymentBalances[a.asaId] ?? 0;
        const bb = paymentBalances[b.asaId] ?? 0;
        if (ba !== bb) return bb - ba;
        if (a.asaId === 0) return -1;
        if (b.asaId === 0) return 1;
        return a.symbol.localeCompare(b.symbol);
      });
  }, [paymentAssets, paymentBalances]);

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
        <SelectTrigger className="h-auto min-h-10 gap-2 bg-white/90 py-2 dark:bg-slate-800/80 [&>span]:!block [&>span]:min-w-0 [&>span]:w-full">
          <SelectValue placeholder="Select asset" />
        </SelectTrigger>
        <SelectContent className="min-w-[min(100vw-2rem,22rem)]">
          <SelectItem
            value={encodeHaystackPaymentSelectValue(null)}
            className="pr-3 [&>span:last-child]:w-full"
          >
            <PaymentAssetOptionRow
              iconSrc={debtIcon}
              title={debtSymbol}
              subtitle="same asset"
              balance={debtBalance}
              usdValue={debtUsd}
            />
          </SelectItem>
          {sortedPaymentAssets.map((a) => {
            const bal = paymentBalances?.[a.asaId];
            const price = paymentUsdPrices?.[a.asaId];
            const usd =
              bal != null && price != null && price > 0
                ? bal * price
                : bal != null
                  ? 0
                  : null;
            return (
              <SelectItem
                key={a.asaId}
                value={encodeHaystackPaymentSelectValue(a.asaId)}
                className="pr-3 [&>span:last-child]:w-full"
              >
                <PaymentAssetOptionRow
                  iconSrc={a.logoPath}
                  title={a.name}
                  subtitle={a.symbol}
                  balance={bal}
                  usdValue={usd}
                />
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {selectedPaymentAsaId != null && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Provider
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-slate-100">
            <img
              src="/images/hay-router.png"
              alt=""
              className="h-4 w-4 rounded-sm bg-black object-contain"
            />
            Hay Router
          </span>
        </div>
      )}
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
