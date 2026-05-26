import type {
  AchievementFamily,
  AchievementTier,
} from "@/data/achievementsCatalog";

export type AchievementDisplayStatus = "earned" | "locked";

export type ResolvedAchievementDisplay = {
  status: AchievementDisplayStatus;
  imageUrl: string;
  tier: AchievementTier | null;
  tierLabel: string | null;
};

export function resolveAchievementDisplay(
  family: AchievementFamily,
  earnedTier: AchievementTier | undefined
): ResolvedAchievementDisplay {
  if (!earnedTier) {
    return {
      status: "locked",
      imageUrl: family.tiers.bronze.imageUrl,
      tier: null,
      tierLabel: null,
    };
  }

  return {
    status: "earned",
    imageUrl: family.tiers[earnedTier].imageUrl,
    tier: earnedTier,
    tierLabel: family.tiers[earnedTier].label,
  };
}

export function formatAchievementTierName(tier: AchievementTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function countEarnedAchievements(
  earned: Partial<Record<string, AchievementTier>>
): number {
  return Object.keys(earned).length;
}
