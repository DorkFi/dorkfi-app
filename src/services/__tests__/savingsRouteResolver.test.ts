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
const POOL_C = "3578814346";
const POOL_E = "3585829377";

describe("savingsRouteResolver (core + high-yield)", () => {
  it("includes core singles and high-yield LP keys", () => {
    expect(EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS).toEqual([
      "USDC",
      "ALGO",
      "fUSDC",
    ]);
    expect(EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS).toEqual([
      "LP_TMPOOL2_WAD_USDC",
      "LP_TMPOOL2_UNIT_ALGO",
    ]);
    expect(EASY_SAVINGS_V1_ASSET_CONFIG_KEYS).toEqual([
      ...EASY_SAVINGS_CORE_ASSET_CONFIG_KEYS,
      ...EASY_SAVINGS_HIGH_YIELD_ASSET_CONFIG_KEYS,
    ]);
  });

  it("lists core keys with USDC first including Pool D USDC", () => {
    const keys = listCoreSavingsAssetConfigKeys(NETWORK);
    expect(keys[0]).toBe("USDC");
    expect(keys).toEqual(expect.arrayContaining(["USDC", "ALGO", "fUSDC"]));
    expect(keys).not.toEqual(
      expect.arrayContaining(["WAD", "tALGO", "goBTC", "goETH"])
    );
  });

  it("resolves fUSDC savings to Pool D only", () => {
    const route = resolveSavingsRoute({
      networkId: NETWORK,
      assetConfigKey: "fUSDC",
    });
    expect(route).not.toBeNull();
    expect(route!.marketLabel).toBe("D");
    expect(route!.poolId).toBe("3526240577");
    expect(savingsAccountDisplayLabel(route!)).toBe("Pool D USDC");
    expect(route!.asset.symbol).toBe("USDC");
  });

  it("lists high-yield LP pairs", () => {
    const keys = listHighYieldSavingsAssetConfigKeys(NETWORK);
    expect(keys).toEqual(
      expect.arrayContaining([
        "LP_TMPOOL2_WAD_USDC",
        "LP_TMPOOL2_UNIT_ALGO",
      ])
    );
  });

  it("labels LP accounts with pair names", () => {
    const usdcWad = resolveSavingsRoute({
      networkId: NETWORK,
      assetConfigKey: "LP_TMPOOL2_WAD_USDC",
    });
    const unitAlgo = resolveSavingsRoute({
      networkId: NETWORK,
      assetConfigKey: "LP_TMPOOL2_UNIT_ALGO",
    });
    expect(usdcWad).not.toBeNull();
    expect(unitAlgo).not.toBeNull();
    expect(savingsAccountDisplayLabel(usdcWad!)).toBe("USDC / WAD");
    expect(savingsAccountDisplayLabel(unitAlgo!)).toBe("UNIT / ALGO");
    expect(usdcWad!.poolId).toBe(POOL_E);
    expect(unitAlgo!.poolId).toBe(POOL_C);
  });

  it("resolves native ALGO (not fALGO) onto Pool A by default", () => {
    const route = resolveSavingsRoute({
      networkId: NETWORK,
      assetConfigKey: "ALGO",
    });
    expect(route).not.toBeNull();
    expect(route!.poolId).toBe(POOL_A);
    expect(route!.asset.symbol.toUpperCase()).toBe("ALGO");
    expect(route!.asset.configKey).toBe("ALGO");
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
