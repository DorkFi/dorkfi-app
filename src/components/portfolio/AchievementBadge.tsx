import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AchievementTier } from "@/data/achievementsCatalog";
import {
  formatAchievementTierName,
  type AchievementDisplayStatus,
} from "@/utils/achievementsDisplay";

const TIER_RING: Record<AchievementTier, string> = {
  gold: "ring-yellow-500/60",
  silver: "ring-slate-400/60",
  bronze: "ring-amber-700/50",
};

const TIER_PILL: Record<AchievementTier, string> = {
  gold: "bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40",
  silver:
    "bg-slate-200/80 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200 border-slate-400/40",
  bronze:
    "bg-amber-100/90 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border-amber-700/40",
};

type AchievementBadgeProps = {
  imageUrl: string;
  alt: string;
  status: AchievementDisplayStatus;
  tier?: AchievementTier | null;
  size?: "sm" | "md" | "lg" | "banner";
  showTierPill?: boolean;
  /** When true, banner images load eagerly (use for first visible card only). */
  priorityImage?: boolean;
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<AchievementBadgeProps["size"]>, string> =
  {
    sm: "h-14 w-14",
    md: "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]",
    lg: "h-24 w-24 sm:h-28 sm:w-28",
    banner: "w-full max-w-[13rem] sm:max-w-[14.5rem] aspect-video",
  };

const IMAGE_FIT: Record<NonNullable<AchievementBadgeProps["size"]>, string> = {
  sm: "object-cover",
  md: "object-cover",
  lg: "object-cover",
  banner: "object-contain",
};

export function AchievementBadge({
  imageUrl,
  alt,
  status,
  tier = null,
  size = "md",
  showTierPill = false,
  priorityImage = false,
  className,
}: AchievementBadgeProps) {
  const isLocked = status === "locked";
  const isBanner = size === "banner";
  const loadEager = isBanner && priorityImage;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        className={cn(
          "relative shrink-0 rounded-xl overflow-hidden ring-2 bg-background/80",
          SIZE_CLASSES[size],
          size === "banner" && "bg-muted/30",
          tier && !isLocked ? TIER_RING[tier] : "ring-border/50"
        )}
      >
        <img
          src={imageUrl}
          alt={alt}
          width={size === "banner" ? 512 : undefined}
          height={size === "banner" ? 288 : undefined}
          className={cn(
            "h-full w-full",
            IMAGE_FIT[size],
            isLocked && "grayscale opacity-45"
          )}
          loading={loadEager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={loadEager ? "high" : undefined}
        />
        {isLocked ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/35"
            aria-hidden
          >
            <Lock className="h-5 w-5 text-white/90 drop-shadow" />
          </div>
        ) : null}
      </div>
      {showTierPill && tier && !isLocked ? (
        <span
          className={cn(
            "mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-xs",
            TIER_PILL[tier]
          )}
        >
          {formatAchievementTierName(tier)}
        </span>
      ) : null}
    </div>
  );
}
