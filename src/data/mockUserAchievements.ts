import type {
  AchievementFamilyId,
  AchievementTier,
} from "@/data/achievementsCatalog";

export type UserAchievements = Partial<
  Record<AchievementFamilyId, AchievementTier>
>;

/** Explicit wallet → achievements (production overrides). */
const MOCK_BY_ADDRESS: Record<string, UserAchievements> = {};

export const MOCK_PRESET_OG: UserAchievements = {
  "prefi-degen": "gold",
  "dork-labs-investor": "gold",
  "dork-fighter": "silver",
  "bug-beta-grinder": "gold",
  "hula-looper": "bronze",
};

export const MOCK_PRESET_CASUAL: UserAchievements = {
  "prefi-degen": "bronze",
};

export function getMockAchievementsForAddress(
  address: string
): UserAchievements {
  const normalized = address.trim().toUpperCase();
  if (MOCK_BY_ADDRESS[normalized]) {
    return MOCK_BY_ADDRESS[normalized];
  }

  if (import.meta.env.DEV) {
    return MOCK_PRESET_OG;
  }

  return {};
}
