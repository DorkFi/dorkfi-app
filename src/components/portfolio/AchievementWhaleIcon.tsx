import { cn } from "@/lib/utils";

const WHALE_MASK_URL = "/achievements/whale-icon-mask.png";

type AchievementWhaleIconProps = {
  className?: string;
};

/** Whale silhouette tinted via currentColor (matches trophy ocean-teal / cyan). */
export function AchievementWhaleIcon({ className }: AchievementWhaleIconProps) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        maskImage: `url(${WHALE_MASK_URL})`,
        WebkitMaskImage: `url(${WHALE_MASK_URL})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
