import { cn } from "@/lib/utils";
import {
  POOL_BASE_TOKEN_FILTERS,
  type PoolBaseTokenFilterId,
} from "@/constants/liquidityPools";
import { getTokenImagePath } from "@/utils/tokenImageUtils";

interface PoolsTokenFilterProps {
  value: PoolBaseTokenFilterId;
  onChange: (value: PoolBaseTokenFilterId) => void;
  counts?: Partial<Record<PoolBaseTokenFilterId, number>>;
  className?: string;
}

function FilterChip({
  active,
  onClick,
  label,
  iconSrc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  iconSrc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-ocean-teal/50 bg-ocean-teal/15 text-ocean-teal"
          : "border-border bg-background/80 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className="h-5 w-5 rounded-full border border-border/50 object-contain bg-white"
        />
      ) : null}
      <span>{label}</span>
    </button>
  );
}

const PoolsTokenFilter = ({
  value,
  onChange,
  counts,
  className,
}: PoolsTokenFilterProps) => {
  const allCount = counts?.all;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <FilterChip
        active={value === "all"}
        onClick={() => onChange("all")}
        label={allCount != null ? `All (${allCount})` : "All"}
      />
      {POOL_BASE_TOKEN_FILTERS.map((filter) => {
        const count = counts?.[filter.id];
        return (
          <FilterChip
            key={filter.id}
            active={value === filter.id}
            onClick={() => onChange(filter.id)}
            label={count != null ? `${filter.symbol} (${count})` : filter.symbol}
            iconSrc={getTokenImagePath(filter.symbol)}
          />
        );
      })}
    </div>
  );
};

export default PoolsTokenFilter;
