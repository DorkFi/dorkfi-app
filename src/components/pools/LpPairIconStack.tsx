import { cn } from "@/lib/utils";

interface LpPairIconStackProps {
  asset1Icon?: string;
  asset2Icon?: string;
  /** Shown when pair icons are unavailable (e.g. dedicated LP ASA logo). */
  fallbackIcon?: string;
  alt?: string;
  size?: "sm" | "md";
  /** `stack` = overlapping coins (modals). `mashup` = 45° split in one circle (portfolio). */
  layout?: "stack" | "mashup";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
} as const;

const LpPairIconStack = ({
  asset1Icon,
  asset2Icon,
  fallbackIcon,
  alt = "LP pair",
  size = "md",
  layout = "stack",
  className,
}: LpPairIconStackProps) => {
  const iconSize = sizeClasses[size];

  if (asset1Icon && asset2Icon && layout === "mashup") {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full bg-white dark:bg-slate-900",
          iconSize,
          className
        )}
        role="img"
        aria-label={alt}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: "polygon(0 0, 0 100%, 100% 0)" }}
        >
          <img
            src={asset1Icon}
            alt=""
            className="absolute left-1/2 top-1/2 h-[140%] w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
            aria-hidden
          />
        </div>
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: "polygon(0 100%, 100% 100%, 100% 0)" }}
        >
          <img
            src={asset2Icon}
            alt=""
            className="absolute left-1/2 top-1/2 h-[140%] w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
            aria-hidden
          />
        </div>
        {/* `/` from bottom-left to top-right — matches the clip seam. */}
        <svg
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line
            x1="0"
            y1="100"
            x2="100"
            y2="0"
            className="stroke-white dark:stroke-slate-800"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    );
  }

  if (asset1Icon && asset2Icon) {
    return (
      <div className={cn("flex -space-x-2 shrink-0", className)} aria-hidden>
        <img
          src={asset1Icon}
          alt=""
          className={cn(
            iconSize,
            "rounded-full border border-border/50 object-contain bg-white shadow"
          )}
        />
        <img
          src={asset2Icon}
          alt=""
          className={cn(
            iconSize,
            "rounded-full border border-border/50 object-contain bg-white shadow"
          )}
        />
      </div>
    );
  }

  if (fallbackIcon) {
    return (
      <img
        src={fallbackIcon}
        alt={alt}
        className={cn(iconSize, "rounded-full object-contain shadow shrink-0", className)}
      />
    );
  }

  return null;
};

export default LpPairIconStack;
