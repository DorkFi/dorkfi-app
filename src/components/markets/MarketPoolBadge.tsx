import { cn } from "@/lib/utils";
import { marketPoolBadgeBgClassName } from "@/constants/marketUi";

interface MarketPoolBadgeProps {
  label: string | null | undefined;
  className?: string;
}

/**
 * A/B/D lending pool indicator (matches markets table + portfolio badges).
 */
export function MarketPoolBadge({ label, className }: MarketPoolBadgeProps) {
  if (!label) return null;
  return (
    <div
      className={cn(
        "absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center z-10",
        marketPoolBadgeBgClassName(label),
        className
      )}
    >
      <span className="text-xs font-bold text-white leading-none">{label}</span>
    </div>
  );
}
