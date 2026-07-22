import { afterEach, describe, expect, it, vi } from "vitest";
import { isCrossAssetRepayFeatureEnabled } from "@/services/haystackRouterService";

describe("isCrossAssetRepayFeatureEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off when explicitly disabled", () => {
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "false");
    expect(isCrossAssetRepayFeatureEnabled()).toBe(false);
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "0");
    expect(isCrossAssetRepayFeatureEnabled()).toBe(false);
  });

  it("is on when explicitly enabled", () => {
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "true");
    expect(isCrossAssetRepayFeatureEnabled()).toBe(true);
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "1");
    expect(isCrossAssetRepayFeatureEnabled()).toBe(true);
  });

  it("defaults to DEV when unset (prod builds stay dark)", () => {
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "");
    // Vitest runs with import.meta.env.DEV === true; production builds set DEV false.
    expect(isCrossAssetRepayFeatureEnabled()).toBe(import.meta.env.DEV === true);
  });
});
