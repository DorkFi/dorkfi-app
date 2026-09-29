import { describe, expect, it } from "vitest";
import type { MarketInfo } from "../lendingService";
import { marketInfoOrConfigNtoken } from "../lendingService";
import { getUserFriendlyError } from "@/utils/errorUtils";

const where = {
  action: "Supply",
  poolId: "3333688282",
  marketId: "3210682240",
  networkId: "algorand-mainnet",
};

describe("marketInfoOrConfigNtoken", () => {
  it("keeps a market snapshot that already has an nToken id", () => {
    const marketInfo = { ntokenId: "3333764003", isPaused: true } as MarketInfo;
    expect(marketInfoOrConfigNtoken(marketInfo, "1", where)).toBe(marketInfo);
  });

  it("uses the token config nToken id when the snapshot is missing", () => {
    const resolved = marketInfoOrConfigNtoken(null, "3333764003", where);
    expect(resolved.ntokenId).toBe("3333764003");
    expect(resolved.isPaused).toBe(false);
  });

  it("names the pool and market when neither id is usable", () => {
    expect(() => marketInfoOrConfigNtoken(null, "0", where)).toThrow(
      /Supply could not read market info for pool 3333688282, market 3210682240 \(algorand-mainnet\)/
    );
  });
});

describe("getUserFriendlyError market snapshot", () => {
  it("shows the market-info sentence instead of an internet warning", () => {
    const message =
      "Supply could not read market info for pool 3333688282, market 3210682240 (algorand-mainnet).";
    expect(getUserFriendlyError(new Error(message))).toBe(message);
    expect(
      getUserFriendlyError(new Error("Failed to fetch market info"))
    ).toBe("Failed to fetch market info");
  });

  it("still treats a dropped request as a connection problem", () => {
    expect(getUserFriendlyError(new Error("Failed to fetch"))).toBe(
      "Network connection issue. Please check your internet connection and try again."
    );
  });
});
