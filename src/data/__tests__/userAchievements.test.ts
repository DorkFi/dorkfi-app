import { describe, it, expect } from "vitest";
import {
  entriesToUserAchievements,
  normalizeAchievementAddress,
} from "../userAchievements";

describe("entriesToUserAchievements", () => {
  it("maps JSON TYPE/LEVEL to catalog families and keeps best tier", () => {
    expect(
      entriesToUserAchievements([
        { TYPE: "day-one", LEVEL: "bronze" },
        { TYPE: "day-one", LEVEL: "gold" },
        { TYPE: "vote-first", LEVEL: "gold" },
        { TYPE: "unknown-type", LEVEL: "gold" },
      ])
    ).toEqual({
      "prefi-degen": "gold",
      "vote-first": "gold",
    });
  });
});

describe("normalizeAchievementAddress", () => {
  it("uppercases and trims wallet addresses", () => {
    expect(normalizeAchievementAddress("  abc123  ")).toBe("ABC123");
  });
});
