import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AchievementWhaleIcon } from "./AchievementWhaleIcon";
import { ACHIEVEMENT_FAMILIES } from "@/data/achievementsCatalog";
import { useUserAchievements } from "@/hooks/useUserAchievements";
import { countEarnedAchievements } from "@/utils/achievementsDisplay";
import { AchievementsModal } from "./AchievementsModal";

type AchievementsCompactTriggerProps = {
  address: string;
  isViewOnly?: boolean;
  className?: string;
};

export function AchievementsCompactTrigger({
  address,
  isViewOnly = false,
  className,
}: AchievementsCompactTriggerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: earned = {}, isLoading, isFetching } = useUserAchievements(
    address
  );

  const earnedCount = countEarnedAchievements(earned);
  const totalFamilies = ACHIEVEMENT_FAMILIES.length;
  const loading = isLoading || isFetching;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={cn(
          "group w-full rounded-xl border-2 border-ocean-teal/25 bg-gradient-to-r from-ocean-teal/5 via-cyan-50/80 to-transparent px-3 py-2.5 text-left shadow-sm transition-all hover:border-ocean-teal/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-teal/50 dark:from-ocean-teal/10 dark:via-slate-800/80 dark:to-transparent dark:hover:border-cyan-500/40",
          className
        )}
        aria-label={
          loading
            ? "Loading achievements"
            : `Achievements, ${earnedCount} of ${totalFamilies} earned. Open details.`
        }
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ocean-teal/15 text-ocean-teal dark:bg-cyan-500/15 dark:text-cyan-400">
            <AchievementWhaleIcon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-foreground">
                Achievements
              </span>
              <span className="text-sm font-bold tabular-nums text-ocean-teal dark:text-cyan-400">
                {loading ? "…" : `${earnedCount}/${totalFamilies}`}
              </span>
              {isViewOnly ? (
                <span className="text-[10px] text-muted-foreground">
                  viewing
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground group-hover:text-foreground/80">
              Soulbound badges · tap to view all
            </p>
          </div>

          <ChevronRight
            className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-ocean-teal dark:group-hover:text-cyan-400"
            aria-hidden
          />
        </div>
      </button>

      <AchievementsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        earned={earned}
      />
    </>
  );
}
