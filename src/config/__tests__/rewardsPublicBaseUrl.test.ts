import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REWARDS_PROVIDER_HOST,
  getRewardsProgramPublicBaseUrl,
  getRewardsPublicProviderHost,
  normalizeRewardsPublicBaseUrl,
  REWARDS_PROGRAM_PUBLIC_BASE_URL_REGISTRY,
  resolveRewardsRegistryEntryToOrigin,
} from "../index";

describe("normalizeRewardsPublicBaseUrl", () => {
  it("trims and strips trailing slashes", () => {
    expect(normalizeRewardsPublicBaseUrl("  https://x.example.com/  ")).toBe(
      "https://x.example.com"
    );
    expect(normalizeRewardsPublicBaseUrl("https://x.example.com///")).toBe(
      "https://x.example.com"
    );
  });
});

describe("getRewardsPublicProviderHost", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to rewards.nautilus.sh", () => {
    expect(DEFAULT_REWARDS_PROVIDER_HOST).toBe("rewards.nautilus.sh");
    expect(getRewardsPublicProviderHost()).toBe("rewards.nautilus.sh");
  });

  it("respects VITE_REWARDS_PROVIDER_HOST", () => {
    vi.stubEnv("VITE_REWARDS_PROVIDER_HOST", "rewards.example.com");
    expect(getRewardsPublicProviderHost()).toBe("rewards.example.com");
  });

  it("strips scheme from a full URL value", () => {
    vi.stubEnv("VITE_REWARDS_PROVIDER_HOST", "https://staging.rewards.example.com/");
    expect(getRewardsPublicProviderHost()).toBe("staging.rewards.example.com");
  });
});

describe("resolveRewardsRegistryEntryToOrigin", () => {
  it("builds https origin from instance id and provider host override", () => {
    expect(
      resolveRewardsRegistryEntryToOrigin("fa00f0044fc97455", "rewards.example.com")
    ).toBe("https://fa00f0044fc97455.rewards.example.com");
  });

  it("accepts a full URL as registry value", () => {
    expect(
      resolveRewardsRegistryEntryToOrigin("https://legacy.example.com/app/")
    ).toBe("https://legacy.example.com/app");
  });
});

describe("getRewardsProgramPublicBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the registered origin for a known network/pool/contract triple", () => {
    expect(
      getRewardsProgramPublicBaseUrl(
        "algorand-mainnet",
        "47139781",
        "47138068"
      )
    ).toBe("https://fa00f0044fc97455.rewards.nautilus.sh");
  });

  it("normalizes network id case for registry lookup", () => {
    expect(
      getRewardsProgramPublicBaseUrl(
        "ALGORAND-MAINNET",
        "47139781",
        "47138068"
      )
    ).toBe("https://fa00f0044fc97455.rewards.nautilus.sh");
  });

  it("uses VITE_REWARDS_PROVIDER_HOST when resolving instance id", () => {
    vi.stubEnv("VITE_REWARDS_PROVIDER_HOST", "rewards.example.com");
    expect(
      getRewardsProgramPublicBaseUrl(
        "algorand-mainnet",
        "47139781",
        "47138068"
      )
    ).toBe("https://fa00f0044fc97455.rewards.example.com");
  });

  it("returns null for an unknown triple", () => {
    expect(
      getRewardsProgramPublicBaseUrl(
        "algorand-mainnet",
        "47139781",
        "99999999"
      )
    ).toBe(null);
  });

  it("returns null when any key part is missing", () => {
    expect(getRewardsProgramPublicBaseUrl(null, "1", "2")).toBe(null);
    expect(getRewardsProgramPublicBaseUrl("voi-mainnet", undefined, "2")).toBe(
      null
    );
    expect(getRewardsProgramPublicBaseUrl("voi-mainnet", "1", null)).toBe(null);
  });

  it("uses token rewardsPublicBaseUrl override when defined (wins over registry)", () => {
    expect(
      getRewardsProgramPublicBaseUrl(
        "algorand-mainnet",
        "47139781",
        "47138068",
        { rewardsPublicBaseUrl: "https://override.example.com/path/" }
      )
    ).toBe("https://override.example.com/path");
    expect(
      REWARDS_PROGRAM_PUBLIC_BASE_URL_REGISTRY["algorand-mainnet:47139781:47138068"]
    ).toBe("fa00f0044fc97455");
  });

  it("uses token rewardsInstanceId over registry (same triple)", () => {
    expect(
      getRewardsProgramPublicBaseUrl(
        "algorand-mainnet",
        "47139781",
        "47138068",
        { rewardsInstanceId: "tokenrow-instance-id" }
      )
    ).toBe("https://tokenrow-instance-id.rewards.nautilus.sh");
  });

  it("prefers rewardsPublicBaseUrl over rewardsInstanceId when both are set", () => {
    expect(
      getRewardsProgramPublicBaseUrl("algorand-mainnet", "47139781", "47138068", {
        rewardsPublicBaseUrl: "https://full-url.wins/",
        rewardsInstanceId: "ignored-instance",
      })
    ).toBe("https://full-url.wins");
  });
});
