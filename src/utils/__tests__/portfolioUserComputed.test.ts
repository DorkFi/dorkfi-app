import { describe, expect, it } from "vitest";
import {
  applyPortfolioUserComputed,
  extractUserProfileAvatar,
} from "@/utils/portfolioUserComputed";

describe("applyPortfolioUserComputed", () => {
  it("returns null when globalUserData is missing", () => {
    expect(applyPortfolioUserComputed({ address: "ADDR" })).toBeNull();
  });

  it("aggregates global totals and splits deposits/borrows", () => {
    const result = applyPortfolioUserComputed({
      address: "ADDR",
      globalUserData: [
        {
          network: "algorand-mainnet",
          totalCollateralValue: "2000000000000000",
          totalBorrowValue: "500000000000000",
        },
        {
          network: "voi-mainnet",
          totalCollateralValue: "1000000000000000",
          totalBorrowValue: "0",
        },
      ],
      userData: [
        { scaledDeposits: "100", scaledBorrows: "0" },
        { scaledDeposits: "0", scaledBorrows: "50" },
        { scaledDeposits: "0", scaledBorrows: "0" },
      ],
    });

    expect(result?.computed).toMatchObject({
      globalCollateralValue: 3000,
      globalBorrowValue: 500,
      globalNetPortfolioValue: 2500,
    });
    expect(result?.computed?.deposits).toHaveLength(1);
    expect(result?.computed?.borrows).toHaveLength(1);
    expect(result?.computed?.networkValues["algorand-mainnet"]).toMatchObject({
      collateral: 2000,
      borrow: 500,
      netValue: 1500,
    });
  });
});

describe("extractUserProfileAvatar", () => {
  it("prefers avatar, then avatarImage, then profileImage", () => {
    expect(
      extractUserProfileAvatar({
        avatar: "https://a.example/1.png",
        avatarImage: "https://a.example/2.png",
      })
    ).toBe("https://a.example/1.png");

    expect(
      extractUserProfileAvatar({ avatarImage: "https://a.example/2.png" })
    ).toBe("https://a.example/2.png");

    expect(extractUserProfileAvatar({})).toBeNull();
  });
});
