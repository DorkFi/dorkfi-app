import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PortfolioInsightChipProps = {
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
  highlight?: boolean;
  dimmed?: boolean;
  loading?: boolean;
  onClick: () => void;
  ariaLabel: string;
};

const PortfolioInsightChip = ({
  label,
  primary,
  secondary,
  highlight = false,
  dimmed = false,
  loading = false,
  onClick,
  ariaLabel,
}: PortfolioInsightChipProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    aria-label={ariaLabel}
    aria-busy={loading}
    className={cn(
      "bg-muted/20 p-4 text-left transition-colors dark:bg-muted/10 sm:p-4",
      "hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ocean-teal/50",
      highlight &&
        "bg-yellow-400/10 hover:bg-yellow-400/15 dark:bg-yellow-400/10 dark:hover:bg-yellow-400/15",
      dimmed && !highlight && "opacity-75 hover:opacity-100"
    )}
  >
    <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
      {label}
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : null}
    </div>
    <div
      className={cn(
        "text-xl font-bold tabular-nums leading-tight",
        highlight
          ? "text-slate-900 dark:text-yellow-100"
          : "text-foreground"
      )}
    >
      {primary}
    </div>
    {secondary ? (
      <div className="mt-1 text-xs text-muted-foreground">{secondary}</div>
    ) : null}
  </button>
);

export default PortfolioInsightChip;
