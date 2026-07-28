import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_HAYSTACK_PROXY_URL,
  getHaystackProxyBaseUrl,
  isCrossAssetRepayFeatureEnabled,
} from "@/services/haystackRouterService";

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

describe("getHaystackProxyBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers absolute VITE_HAYSTACK_PROXY_URL", () => {
    vi.stubEnv(
      "VITE_HAYSTACK_PROXY_URL",
      "https://custom-proxy.example.com/"
    );
    expect(getHaystackProxyBaseUrl("https://beta.dork.fi")).toBe(
      "https://custom-proxy.example.com"
    );
  });

  it("uses Railway proxy on beta even if env is a relative path", () => {
    vi.stubEnv("VITE_HAYSTACK_PROXY_URL", "/api/haystack");
    expect(getHaystackProxyBaseUrl("https://beta.dork.fi")).toBe(
      DEFAULT_HAYSTACK_PROXY_URL
    );
  });

  it("uses Vite middleware path in DEV on non-beta origins", () => {
    vi.stubEnv("VITE_HAYSTACK_PROXY_URL", "");
    expect(getHaystackProxyBaseUrl("http://localhost:8080")).toBe(
      import.meta.env.DEV === true
        ? "/api/haystack"
        : DEFAULT_HAYSTACK_PROXY_URL
    );
  });
});
