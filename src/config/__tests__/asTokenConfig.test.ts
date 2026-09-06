import { describe, expect, it } from "vitest";
import { asTokenConfig, type TokenConfig } from "@/config";

const base = (overrides: Partial<TokenConfig>): TokenConfig =>
  ({
    decimals: 6,
    name: "T",
    symbol: "T",
    logoPath: "/t.png",
    tokenStandard: "arc200",
    ...overrides,
  }) as TokenConfig;

describe("asTokenConfig", () => {
  it("returns undefined for nullish", () => {
    expect(asTokenConfig(undefined)).toBeUndefined();
    expect(asTokenConfig(null)).toBeUndefined();
  });

  it("returns a single TokenConfig unchanged", () => {
    const t = base({ poolId: "1" });
    expect(asTokenConfig(t)).toBe(t);
  });

  it("picks matching pool from an array", () => {
    const a = base({ poolId: "10", symbol: "A" });
    const b = base({ poolId: "20", symbol: "B" });
    expect(asTokenConfig([a, b], "20")).toBe(b);
  });

  it("returns the sole array entry even without poolId", () => {
    const a = base({ poolId: "10" });
    expect(asTokenConfig([a])).toBe(a);
    expect(asTokenConfig([a], "999")).toBe(a);
  });

  it("does not silently pick the first row when pool is missing or unmatched", () => {
    const a = base({ poolId: "10" });
    const b = base({ poolId: "20" });
    expect(asTokenConfig([a, b])).toBeUndefined();
    expect(asTokenConfig([a, b], "999")).toBeUndefined();
  });
});
