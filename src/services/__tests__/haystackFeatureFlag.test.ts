import { afterEach, describe, expect, it, vi } from "vitest";
import { isCrossAssetRepayFeatureEnabled } from "@/services/haystackRouterService";

describe("isCrossAssetRepayFeatureEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off when explicitly disabled", () => {
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "false");
    expect(isCrossAssetRepayFeatureEnabled()).toBe(false);
    expect(isCrossAssetRepayFeatureEnabled("https://beta.dork.fi")).toBe(false);
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "0");
    expect(isCrossAssetRepayFeatureEnabled()).toBe(false);
  });

  it("is on when explicitly enabled", () => {
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "true");
    expect(isCrossAssetRepayFeatureEnabled()).toBe(true);
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "1");
    expect(isCrossAssetRepayFeatureEnabled()).toBe(true);
  });

  it("auto-enables on beta.dork.fi when unset", () => {
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "");
    expect(isCrossAssetRepayFeatureEnabled("https://beta.dork.fi")).toBe(true);
  });

  it("defaults to DEV when unset on other origins", () => {
    vi.stubEnv("VITE_ENABLE_CROSS_ASSET_REPAY", "");
    // Vitest runs with import.meta.env.DEV === true; production builds set DEV false.
    expect(isCrossAssetRepayFeatureEnabled("https://app.dork.fi")).toBe(
      import.meta.env.DEV === true
    );
  });
});
