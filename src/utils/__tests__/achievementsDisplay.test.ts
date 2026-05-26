import { describe, it, expect } from "vitest";
import {
  countEarnedAchievements,
  formatAchievementTierName,
  resolveAchievementDisplay,
} from "../achievementsDisplay";
import { ACHIEVEMENT_FAMILY_BY_ID } from "@/data/achievementsCatalog";

describe("resolveAchievementDisplay", () => {
  const prefi = ACHIEVEMENT_FAMILY_BY_ID["prefi-degen"];

  it("returns locked state with bronze silhouette when not earned", () => {
    const result = resolveAchievementDisplay(prefi, undefined);
    expect(result.status).toBe("locked");
    expect(result.tier).toBeNull();
    expect(result.imageUrl).toContain("/prefi-degen/bronze.png");
  });

  it("returns earned tier image and label", () => {
    const result = resolveAchievementDisplay(prefi, "gold");
    expect(result.status).toBe("earned");
    expect(result.tier).toBe("gold");
    expect(result.tierLabel).toBe("First 6.9 hours");
    expect(result.imageUrl).toContain("/prefi-degen/gold.png");
  });
});

describe("formatAchievementTierName", () => {
  it("capitalizes tier names", () => {
    expect(formatAchievementTierName("silver")).toBe("Silver");
  });
});

describe("countEarnedAchievements", () => {
  it("counts earned families", () => {
    expect(
      countEarnedAchievements({
        "prefi-degen": "gold",
        "dork-fighter": "bronze",
      })
    ).toBe(2);
  });
});
