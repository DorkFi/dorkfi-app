import { cn } from "@/lib/utils";

interface LpPairIconStackProps {
  asset1Icon?: string;
  asset2Icon?: string;
  /** Shown when pair icons are unavailable (e.g. dedicated LP ASA logo). */
  fallbackIcon?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Silver ring matched to DeFi pair-token treatment (WAD/USDC stacks, etc.). */
const RING =
  "rounded-full border-[1.5px] border-[#c8cdd6] object-cover bg-[#0a1628] shadow-sm ring-1 ring-black/10";

const sizeClasses = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
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
  const overlap =
    size === "sm" ? "-space-x-2.5" : size === "lg" ? "-space-x-4" : "-space-x-3";

  if (asset1Icon && asset2Icon) {
    return (
      <div
        className={cn("flex shrink-0 items-center", overlap, className)}
        aria-label={alt}
      >
        <img
          src={asset1Icon}
          alt=""
          className={cn(iconSize, RING, "relative z-0")}
        />
        <img
          src={asset2Icon}
          alt=""
          className={cn(iconSize, RING, "relative z-10")}
        />
      </div>
    );
  }

  if (fallbackIcon) {
    return (
      <img
        src={fallbackIcon}
        alt={alt}
        className={cn(
          size === "sm" ? "h-7" : size === "lg" ? "h-12" : "h-9",
          "w-auto object-contain shrink-0 drop-shadow-sm",
          className
        )}
      />
    );
  }

  return null;
};

export default LpPairIconStack;
