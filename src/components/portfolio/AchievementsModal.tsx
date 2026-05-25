import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, Info } from "lucide-react";
import { AchievementWhaleIcon } from "./AchievementWhaleIcon";
import {
  ACHIEVEMENT_DOCS_URL,
  ACHIEVEMENT_FAMILIES,
  type AchievementFamily,
  type AchievementTier,
} from "@/data/achievementsCatalog";
import type { UserAchievements } from "@/data/mockUserAchievements";
import { resolveAchievementDisplay } from "@/utils/achievementsDisplay";
import { AchievementBadge } from "./AchievementBadge";
import { Button } from "@/components/ui/button";

type AchievementsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  earned: UserAchievements;
};

const AchievementModalCard = memo(function AchievementModalCard({
  family,
  earnedTier,
  priorityImage = false,
}: {
  family: AchievementFamily;
  earnedTier?: AchievementTier;
  priorityImage?: boolean;
}) {
  const display = resolveAchievementDisplay(family, earnedTier);
  const isEarned = display.status === "earned";

  return (
    <article
      className={`rounded-xl border p-4 ${
        isEarned
          ? "border-ocean-teal/30 bg-ocean-teal/5"
          : "border-border/60 bg-muted/30"
      }`}
    >
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <AchievementBadge
          imageUrl={display.imageUrl}
          alt={family.title}
          status={display.status}
          tier={display.tier}
          showTierPill
          size="banner"
          priorityImage={priorityImage}
          className="shrink-0 sm:w-auto"
        />
        <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h3 className="text-base font-semibold text-foreground">
              {family.title}
            </h3>
            {family.limitedEdition ? (
              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Limited
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{family.description}</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              <span className="font-medium text-yellow-600 dark:text-yellow-400">
                Gold:
              </span>{" "}
              {family.tiers.gold.label}
            </li>
            <li>
              <span className="font-medium text-slate-500 dark:text-slate-300">
                Silver:
              </span>{" "}
              {family.tiers.silver.label}
            </li>
            <li>
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Bronze:
              </span>{" "}
              {family.tiers.bronze.label}
            </li>
          </ul>
          {!isEarned ? (
            <p className="text-xs text-muted-foreground">{family.lockedHint}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
});

export function AchievementsModal({
  open,
  onOpenChange,
  earned,
}: AchievementsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,880px)] w-full max-w-[min(100vw-1.5rem,42rem)] flex-col overflow-hidden border border-gray-200/50 bg-gradient-to-br from-blue-50 to-cyan-50 p-0 shadow-xl dark:border-ocean-teal/20 dark:from-slate-900 dark:to-slate-800 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-gray-200/50 px-6 pb-4 pt-10 text-left dark:border-ocean-teal/20 sm:px-8 sm:pt-12">
          <DialogTitle className="flex items-center gap-2 text-left text-xl sm:text-2xl">
            <AchievementWhaleIcon className="h-6 w-6 text-ocean-teal dark:text-cyan-400" />
            Your Achievements
          </DialogTitle>
          <DialogDescription className="text-left text-sm sm:text-base">
            Soulbound NFT badges celebrate your contributions on DorkFi. Soulbound
            achievements are permanently tied to your wallet. You receive only the
            highest tier per category.
          </DialogDescription>
        </DialogHeader>

        <div
          className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain bg-background px-6 py-5 [-webkit-overflow-scrolling:touch] sm:px-8"
          style={{ scrollBehavior: "auto" }}
        >
          <div
            className="mb-5 flex gap-2 rounded-lg border border-ocean-teal/25 bg-ocean-teal/5 px-3 py-2.5 text-xs text-muted-foreground"
            role="note"
          >
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-ocean-teal dark:text-cyan-400"
              aria-hidden
            />
            <p>
              <span className="font-medium text-foreground">Preview</span> —
              soulbound achievement NFTs will appear on your profile after
              distribution.
            </p>
          </div>

          <div className="space-y-4">
            {ACHIEVEMENT_FAMILIES.map((family, index) => (
              <AchievementModalCard
                key={family.id}
                family={family}
                earnedTier={earned[family.id]}
                priorityImage={index === 0}
              />
            ))}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-gray-200/50 bg-background/80 px-6 py-4 dark:border-ocean-teal/20 sm:justify-end sm:px-8">
          <Button
            variant="outline"
            asChild
            className="w-full border-ocean-teal/40 sm:w-auto"
          >
            <a
              href={ACHIEVEMENT_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
