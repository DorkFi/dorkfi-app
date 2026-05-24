export type AchievementTier = "gold" | "silver" | "bronze";

export type AchievementFamilyId =
  | "prefi-degen"
  | "dork-labs-investor"
  | "dork-fighter"
  | "bug-beta-grinder"
  | "hula-looper";

export type AchievementTierDefinition = {
  label: string;
  imageUrl: string;
};

export type AchievementFamily = {
  id: AchievementFamilyId;
  title: string;
  description: string;
  lockedHint: string;
  limitedEdition?: boolean;
  tiers: Record<AchievementTier, AchievementTierDefinition>;
};

export const ACHIEVEMENT_TIER_ORDER: AchievementTier[] = [
  "gold",
  "silver",
  "bronze",
];

export const ACHIEVEMENT_DOCS_URL = "https://docs.dork.fi/achievements";

function tierImage(
  familyId: AchievementFamilyId,
  tier: AchievementTier
): string {
  return `/achievements/${familyId}/${tier}.png`;
}

export const ACHIEVEMENT_FAMILIES: AchievementFamily[] = [
  {
    id: "prefi-degen",
    title: "Day One PreFi Degen",
    description:
      "Awarded to users who supplied assets during the PreFi (Pre-Finance) phase launch.",
    lockedHint: "Supply assets during PreFi to unlock",
    tiers: {
      gold: {
        label: "First 6.9 hours",
        imageUrl: tierImage("prefi-degen", "gold"),
      },
      silver: {
        label: "First 42 hours",
        imageUrl: tierImage("prefi-degen", "silver"),
      },
      bronze: {
        label: "Participate in PreFi",
        imageUrl: tierImage("prefi-degen", "bronze"),
      },
    },
  },
  {
    id: "dork-labs-investor",
    title: "Dork Labs Investor",
    description:
      "Recognizes users who invest in Dork Labs Inc. You receive only the highest tier you qualify for.",
    lockedHint: "$1,000+ investment in Dork Labs Inc.",
    tiers: {
      gold: {
        label: "$5,000 or more",
        imageUrl: tierImage("dork-labs-investor", "gold"),
      },
      silver: {
        label: "$3,000 to $4,999",
        imageUrl: tierImage("dork-labs-investor", "silver"),
      },
      bronze: {
        label: "$1,000 to $2,999",
        imageUrl: tierImage("dork-labs-investor", "bronze"),
      },
    },
  },
  {
    id: "dork-fighter",
    title: "Dork Fighter",
    description:
      "Awarded for donations supporting the Dork Rxelms playable character. Highest qualifying tier only.",
    lockedHint: "$10+ donation to Dork Rxelms development",
    tiers: {
      gold: {
        label: "$50 or more",
        imageUrl: tierImage("dork-fighter", "gold"),
      },
      silver: {
        label: "$20 to $49",
        imageUrl: tierImage("dork-fighter", "silver"),
      },
      bronze: {
        label: "$10 to $19",
        imageUrl: tierImage("dork-fighter", "bronze"),
      },
    },
  },
  {
    id: "bug-beta-grinder",
    title: "Bug and Beta Grinder",
    description:
      "Awarded to users who assisted during beta testing ahead of main release. Also earned by future bug hunters.",
    lockedHint: "Contribute during beta or bug bounty periods",
    tiers: {
      gold: {
        label: "Maximum effort",
        imageUrl: tierImage("bug-beta-grinder", "gold"),
      },
      silver: {
        label: "Average effort",
        imageUrl: tierImage("bug-beta-grinder", "silver"),
      },
      bronze: {
        label: "Teeny tiny effort",
        imageUrl: tierImage("bug-beta-grinder", "bronze"),
      },
    },
  },
  {
    id: "hula-looper",
    title: "Hula Looper",
    description:
      "Earned by users who found new yield methods and shared them during the Teach Me How to DeFi competition.",
    lockedHint: "Top 10 in the Dec 2025 Teach Me How to DeFi competition",
    limitedEdition: true,
    tiers: {
      gold: {
        label: "1st – 3rd place",
        imageUrl: tierImage("hula-looper", "gold"),
      },
      silver: {
        label: "4th – 6th place",
        imageUrl: tierImage("hula-looper", "silver"),
      },
      bronze: {
        label: "7th – 10th place",
        imageUrl: tierImage("hula-looper", "bronze"),
      },
    },
  },
];

export const ACHIEVEMENT_FAMILY_BY_ID: Record<
  AchievementFamilyId,
  AchievementFamily
> = Object.fromEntries(
  ACHIEVEMENT_FAMILIES.map((family) => [family.id, family])
) as Record<AchievementFamilyId, AchievementFamily>;
