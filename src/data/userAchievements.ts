import {
  ACHIEVEMENT_TIER_ORDER,
  type AchievementFamilyId,
  type AchievementTier,
} from "@/data/achievementsCatalog";

export type UserAchievements = Partial<
  Record<AchievementFamilyId, AchievementTier>
>;

/** Raw entry shape in `public/achievements/dorkfi-achievements.json`. */
export type DorkfiAchievementEntry = {
  LEVEL: string;
  TYPE: string;
};

export type DorkfiAchievementsByAddress = Record<
  string,
  DorkfiAchievementEntry[]
>;

const ACHIEVEMENTS_JSON_URL = "/achievements/dorkfi-achievements.json";

/** Maps backend `TYPE` slugs to catalog family ids. */
export const DORKFI_ACHIEVEMENT_TYPE_TO_FAMILY: Record<
  string,
  AchievementFamilyId
> = {
  "day-one": "prefi-degen",
  investor: "dork-labs-investor",
  fighter: "dork-fighter",
  "bug-beta": "bug-beta-grinder",
  "hula-loop": "hula-looper",
  "vote-first": "vote-first",
};

const TIER_RANK = new Map(
  ACHIEVEMENT_TIER_ORDER.map((tier, index) => [tier, index])
);

let achievementsByAddressPromise: Promise<DorkfiAchievementsByAddress> | null =
  null;

export function normalizeAchievementAddress(address: string): string {
  return address.trim().toUpperCase();
}

function isAchievementTier(value: string): value is AchievementTier {
  return TIER_RANK.has(value as AchievementTier);
}

export function entriesToUserAchievements(
  entries: DorkfiAchievementEntry[]
): UserAchievements {
  const earned: UserAchievements = {};

  for (const entry of entries) {
    const familyId =
      DORKFI_ACHIEVEMENT_TYPE_TO_FAMILY[entry.TYPE.trim().toLowerCase()];
    const tier = entry.LEVEL.trim().toLowerCase();
    if (!familyId || !isAchievementTier(tier)) continue;

    const current = earned[familyId];
    if (
      current === undefined ||
      (TIER_RANK.get(tier) ?? 99) < (TIER_RANK.get(current) ?? 99)
    ) {
      earned[familyId] = tier;
    }
  }

  return earned;
}

export async function loadDorkfiAchievementsByAddress(): Promise<DorkfiAchievementsByAddress> {
  if (!achievementsByAddressPromise) {
    achievementsByAddressPromise = fetch(ACHIEVEMENTS_JSON_URL).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load achievements (${response.status})`
          );
        }
        return (await response.json()) as DorkfiAchievementsByAddress;
      }
    );
  }
  return achievementsByAddressPromise;
}

export async function getUserAchievementsForAddress(
  address: string
): Promise<UserAchievements> {
  const normalized = normalizeAchievementAddress(address);
  const byAddress = await loadDorkfiAchievementsByAddress();
  const entries = byAddress[normalized];
  if (!entries?.length) return {};
  return entriesToUserAchievements(entries);
}
