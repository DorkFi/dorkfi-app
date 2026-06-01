import { cn } from "@/lib/utils";

interface LpPairIconStackProps {
  asset1Icon?: string;
  asset2Icon?: string;
  /** Shown when pair icons are unavailable (e.g. dedicated LP ASA logo). */
  fallbackIcon?: string;
  alt?: string;
  size?: "sm" | "md";
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
  className,
}: LpPairIconStackProps) => {
  const iconSize = sizeClasses[size];

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
