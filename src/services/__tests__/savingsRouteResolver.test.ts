import { describe, expect, it } from "vitest";
import {
  EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS,
  EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS,
  EASY_SAVINGS_V1_ASSET_CONFIG_KEYS,
  isWadSavingsEligible,
  listCoreSavingsAssetConfigKeys,
  listHighYieldSavingsAssetConfigKeys,
  listSavingsAssetConfigKeys,
  listSavingsRoutes,
  resolveSavingsRoute,
  resolveSavingsRoutes,
  savingsAccountDisplayLabel,
} from "@/services/savingsRouteResolver";
import { getNetworkConfig } from "@/config";

const NETWORK = "algorand-mainnet" as const;
const POOL_A = "3333688282";
const POOL_B = "3345940978";
const POOL_E = "3585829377";

describe("savingsRouteResolver (core + high-yield)", () => {
  it("includes core singles and high-yield LP keys", () => {
    expect(EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS).toEqual(["USDC"]);
    expect(EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS).toEqual([
      "LP_TMPOOL2_WAD_USDC",
    ]);
    expect(EASY_SAVINGS_V1_ASSET_CONFIG_KEYS).toEqual([
      ...EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS,
      ...EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS,
    ]);
  });

  it("lists core keys with USDC only (no ALGO or Pool D USDC)", () => {
    const keys = listCoreSavingsAssetConfigKeys(NETWORK);
    expect(keys).toEqual(["USDC"]);
    expect(keys).not.toEqual(
      expect.arrayContaining(["ALGO", "fUSDC", "WAD", "tALGO", "goBTC", "goETH"])
    );
  });

  it("can still resolve fUSDC to Pool D when requested (not in curated list)", () => {
    const route = resolveSavingsRoute({
      networkId: NETWORK,
      assetConfigKey: "fUSDC",
    });
    // Curated listSavingsRoutes filters by V1 keys; resolve uses that graph.
    // fUSDC is only available when listing the full graph (or explicit key if eligible).
    expect(route).toBeNull();
    const full = listSavingsRoutes(NETWORK, { assetConfigKeys: ["fUSDC"] });
    expect(full.some((r) => r.marketLabel === "D")).toBe(true);
    const poolD = full.find((r) => r.marketLabel === "D");
    expect(poolD).toBeTruthy();
    expect(savingsAccountDisplayLabel(poolD!)).toBe("Pool D USDC");
  });

  it("lists high-yield LP pairs", () => {
    const keys = listHighYieldSavingsAssetConfigKeys(NETWORK);
    expect(keys).toEqual(["LP_TMPOOL2_WAD_USDC"]);
    expect(keys).not.toContain("LP_TMPOOL2_UNIT_ALGO");
  });

  it("labels LP accounts with pair names", () => {
    const usdcWad = resolveSavingsRoute({
      networkId: NETWORK,
      assetConfigKey: "LP_TMPOOL2_WAD_USDC",
    });
    expect(usdcWad).not.toBeNull();
    expect(savingsAccountDisplayLabel(usdcWad!)).toBe("USDC / WAD");
    expect(usdcWad!.poolId).toBe(POOL_E);
  });

  it("resolves native ALGO when listed explicitly (not in curated core)", () => {
    const route = resolveSavingsRoute({
      networkId: NETWORK,
      assetConfigKey: "ALGO",
    });
    // ALGO is off the curated V1 list, so default resolve is null.
    expect(route).toBeNull();
    const explicit = listSavingsRoutes(NETWORK, { assetConfigKeys: ["ALGO"] });
    expect(explicit.length).toBeGreaterThan(0);
    expect(explicit[0]!.poolId).toBe(POOL_A);
    expect(explicit[0]!.asset.symbol.toUpperCase()).toBe("ALGO");
    expect(explicit[0]!.asset.configKey).toBe("ALGO");
  });

  it("resolves USDC onto Pool A by default", () => {
    const route = resolveSavingsRoute({
      networkId: NETWORK,
      assetConfigKey: "USDC",
    });
    expect(route).not.toBeNull();
    expect(route!.poolId).toBe(POOL_A);
    expect(route!.marketLabel).toBe("A");
    expect(route!.asset.symbol).toBe("USDC");
  });

  it("returns USDC candidates on A and B", () => {
    const routes = resolveSavingsRoutes({
      networkId: NETWORK,
      assetConfigKey: "USDC",
    });
    const pools = new Set(routes.map((r) => r.poolId));
    expect(pools.has(POOL_A)).toBe(true);
    expect(pools.has(POOL_B)).toBe(true);
  });

  it("prefers an existing-position pool when preferredPoolIds is set", () => {
    const route = resolveSavingsRoute({
      networkId: NETWORK,
      assetConfigKey: "USDC",
      preferredPoolIds: [POOL_B],
    });
    expect(route!.poolId).toBe(POOL_B);
  });

  it("excludes stoken / LP-borrow WAD rows from savings", () => {
    const wadToken = getNetworkConfig(NETWORK).tokens.WAD;
    const rows = Array.isArray(wadToken) ? wadToken : [wadToken];
    const stokenA = rows.find(
      (t) => String(t.poolId) === POOL_A && t.isStoken
    );
    expect(stokenA).toBeTruthy();
    expect(isWadSavingsEligible(NETWORK, stokenA!)).toBe(false);

    const routes = listSavingsRoutes(NETWORK, {
      assetConfigKeys: ["WAD"],
    });
    expect(routes.every((r) => r.poolId !== POOL_A || !r.assetToken.isStoken)).toBe(
      true
    );
    // Default WAD savings should not be the Pool A mint market.
    expect(routes[0]?.poolId).not.toBe(POOL_A);
    expect(routes.length).toBeGreaterThan(0);
  });

  it("can list the full deposit graph when assetConfigKeys is null", () => {
    const full = listSavingsRoutes(NETWORK, { assetConfigKeys: null });
    const curated = listSavingsRoutes(NETWORK);
    expect(full.length).toBeGreaterThan(curated.length);
    expect(full.some((r) => r.asset.configKey === "ALGO")).toBe(true);
  });

  it("orders curated keys with core before high-yield", () => {
    const keys = listSavingsAssetConfigKeys(NETWORK);
    const usdc = keys.indexOf("USDC");
    const lp = keys.indexOf("LP_TMPOOL2_WAD_USDC");
    expect(usdc).toBeGreaterThanOrEqual(0);
    expect(lp).toBeGreaterThan(usdc);
  });

  it("returns null for unknown assets", () => {
    expect(
      resolveSavingsRoute({
        networkId: NETWORK,
        assetConfigKey: "NOT_A_TOKEN",
      })
    ).toBeNull();
  });
});
