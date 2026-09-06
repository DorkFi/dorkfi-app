import { describe, expect, it } from "vitest";
import { asaAmountFromAccountInfo } from "@/utils/walletBalanceRpc";

describe("asaAmountFromAccountInfo", () => {
  it("returns null when accountInfo missing or assets not an array", () => {
    expect(asaAmountFromAccountInfo(null, 1)).toBeNull();
    expect(asaAmountFromAccountInfo({}, 1)).toBeNull();
    expect(asaAmountFromAccountInfo({ assets: "x" }, 1)).toBeNull();
  });

  it("reads amount from kebab-case asset-id", () => {
    const info = {
      assets: [{ "asset-id": 42, amount: "12345" }],
    };
    expect(asaAmountFromAccountInfo(info, 42)).toBe(12345n);
  });

  it("reads amount from camelCase assetId", () => {
    const info = {
      assets: [{ assetId: 7, amount: 99 }],
    };
    expect(asaAmountFromAccountInfo(info, 7)).toBe(99n);
  });

  it("returns 0n when opted-in list omits the asset", () => {
    const info = {
      assets: [{ "asset-id": 1, amount: "10" }],
    };
    expect(asaAmountFromAccountInfo(info, 2)).toBe(0n);
  });

  it("returns 0n when amount is missing on a matching row", () => {
    const info = {
      assets: [{ "asset-id": 5 }],
    };
    expect(asaAmountFromAccountInfo(info, 5)).toBe(0n);
  });
});
