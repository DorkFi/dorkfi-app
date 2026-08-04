import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { getTokenImagePath } from "@/utils/tokenImageUtils";
import { formatUsdAmount } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type AssetSelectorOption = {
  configKey: string;
  symbol: string;
  logoPath?: string;
  balance?: number | null;
  balanceUsd?: number | null;
  subtitle?: string;
  disabled?: boolean;
};

type AssetSelectorProps = {
  label: string;
  options: AssetSelectorOption[];
  value: string;
  onChange: (configKey: string) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  amountUsd?: number | null;
  onMax?: () => void;
  showMax?: boolean;
  amountDisabled?: boolean;
  footer?: ReactNode;
  /** Optional control rendered opposite the label (e.g. "Add more +"). */
  headerAction?: ReactNode;
  /** When true, wraps content in a bordered card suitable for side-by-side grids. */
  card?: boolean;
};

function formatBalance(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

const AssetSelector = ({
  label,
  options,
  value,
  onChange,
  amount,
  onAmountChange,
  amountUsd,
  onMax,
  showMax = false,
  amountDisabled = false,
  footer,
  headerAction,
  card = false,
}: AssetSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.configKey === value) ?? options[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.configKey.toLowerCase().includes(q) ||
        o.symbol.toLowerCase().includes(q) ||
        (o.subtitle?.toLowerCase().includes(q) ?? false)
    );
  }, [options, query]);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-medium",
            card ? "text-base text-foreground" : "text-sm text-muted-foreground"
          )}
        >
          {label}
        </span>
        <div className="flex items-center gap-2">
          {headerAction}
          {showMax && onMax && !headerAction ? (
            <button
              type="button"
              onClick={onMax}
              className="text-xs font-semibold text-ocean-teal hover:underline"
            >
              MAX
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "rounded-2xl p-3",
          card
            ? "bg-muted/50 border-0"
            : "border border-border bg-muted/30"
        )}
      >
        <div className="flex items-start gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-card border border-border px-2.5 py-2 text-sm font-medium shadow-sm hover:bg-accent/40"
            >
              {selected ? (
                <img
                  src={
                    selected.logoPath ||
                    getTokenImagePath(selected.symbol) ||
                    "/placeholder.svg"
                  }
                  alt=""
                  className="size-6 rounded-full"
                />
              ) : null}
              <span>{selected?.symbol ?? "Select"}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>

            {open ? (
              <div className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <Search className="size-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {filtered.map((option) => (
                    <button
                      key={option.configKey}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => {
                        onChange(option.configKey);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-muted",
                        option.disabled && "opacity-40 pointer-events-none",
                        option.configKey === value && "bg-muted"
                      )}
                    >
                      <img
                        src={
                          option.logoPath ||
                          getTokenImagePath(option.symbol) ||
                          "/placeholder.svg"
                        }
                        alt=""
                        className="size-7 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{option.symbol}</div>
                        {option.subtitle ? (
                          <div className="text-xs text-muted-foreground truncate">
                            {option.subtitle}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right text-xs">
                        <div>{formatBalance(option.balance)}</div>
                        <div className="text-muted-foreground">
                          {option.balanceUsd != null &&
                          Number.isFinite(option.balanceUsd)
                            ? formatUsdAmount(option.balanceUsd)
                            : "—"}
                        </div>
                      </div>
                      {option.configKey === value ? (
                        <Check className="size-4 text-ocean-teal shrink-0" />
                      ) : (
                        <span className="size-4 shrink-0" />
                      )}
                    </button>
                  ))}
                  {filtered.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      No assets found
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 text-right">
            <input
              inputMode="decimal"
              value={amount}
              disabled={amountDisabled}
              onChange={(e) =>
                onAmountChange(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="0"
              className="w-full bg-transparent text-right text-2xl font-semibold outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
            <p className="text-sm text-muted-foreground">
              {amountUsd != null && Number.isFinite(amountUsd)
                ? `≈ ${formatUsdAmount(amountUsd)}`
                : "$0.00"}
            </p>
          </div>
        </div>
        {footer ? (
          <div className="mt-2 text-xs text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </>
  );

  if (card) {
    return (
      <div className="space-y-3 rounded-[24px] border border-border/60 bg-card p-4 sm:p-5 h-full">
        {body}
      </div>
    );
  }

  return <div className="space-y-2">{body}</div>;
};

export default AssetSelector;
