import { describe, it, expect } from "vitest";
import { shouldShowConfigSymbolUnderDisplayAsset } from "../portfolioAssetSubline";

describe("shouldShowConfigSymbolUnderDisplayAsset", () => {
  it("hides fALGO under Algo display", () => {
    expect(shouldShowConfigSymbolUnderDisplayAsset("Algo", "fALGO")).toBe(
      false
    );
  });

  it("still shows distinct keys when useful", () => {
    expect(shouldShowConfigSymbolUnderDisplayAsset("USDC", "USDCa")).toBe(true);
  });

  it("hides when config matches display", () => {
    expect(shouldShowConfigSymbolUnderDisplayAsset("USDC", "USDC")).toBe(
      false
    );
  });

  it("hides when config missing", () => {
    expect(shouldShowConfigSymbolUnderDisplayAsset("Algo", undefined)).toBe(
      false
    );
  });

  it("hides TMPOOL2 config keys under pair display labels", () => {
    expect(
      shouldShowConfigSymbolUnderDisplayAsset(
        "UNIT/ALGO LP",
        "LP_TMPOOL2_UNIT_ALGO"
      )
    ).toBe(false);
  });
});
