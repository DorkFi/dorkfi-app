import { describe, expect, it } from "vitest";
import {
  getUnitLendingCollateralContractIds,
  getUnitLendingWadBorrowMarketRef,
  getWadLpLendingCollateralContractIds,
  getUsdcLpLendingCollateralContractIds,
} from "@/config";
import {
  EASY_BORROW_POOL_D_USDC_UI_KEY,
  EASY_BORROW_V1_BORROW_CONFIG_KEYS,
  listBorrowAssetOptionsForCollateral,
  listBorrowConfigKeysForCollateral,
  listBorrowRoutes,
  listCollateralConfigKeys,
  resolveBorrowRoute,
  resolveBorrowRoutes,
} from "@/services/borrowRouteResolver";

const NETWORK = "algorand-mainnet" as const;
const POOL_A = "3333688282";
const POOL_B = "3345940978";
const POOL_C = "3578814346";
const POOL_D = "3526240577";

describe("borrowRouteResolver (v1 WAD/USDC)", () => {
  it("defaults to WAD and USDC borrow assets only", () => {
    expect(EASY_BORROW_V1_BORROW_CONFIG_KEYS).toEqual(["WAD", "USDC"]);
    const routes = listBorrowRoutes(NETWORK);
    expect(routes.length).toBeGreaterThan(10);
    expect(
      routes.every(
        (r) =>
          r.borrow.configKey === "WAD" ||
          r.borrow.configKey === "USDC" ||
          // Pool D Folks USDC is stored as fUSDC but treated as USDC in the UI.
          (r.borrow.configKey === "fUSDC" && r.marketLabel === "D")
      )
    ).toBe(true);
  });

  it("can still list the full graph when borrowConfigKeys is null", () => {
    const full = listBorrowRoutes(NETWORK, { borrowConfigKeys: null });
    const v1 = listBorrowRoutes(NETWORK);
    expect(full.length).toBeGreaterThan(v1.length);
  });

  it("resolves ALGO → WAD onto Pool A mint path by default", () => {
    const route = resolveBorrowRoute({
      networkId: NETWORK,
      collateralConfigKey: "ALGO",
      borrowConfigKey: "WAD",
      collateralPoolId: POOL_A,
    });
    expect(route).not.toBeNull();
    expect(route!.poolId).toBe(POOL_A);
    expect(route!.marketLabel).toBe("A");
    expect(route!.mechanism).toBe("wad_mint_via_borrow");
    expect(route!.borrow.isStoken).toBe(true);
  });

  it("resolves ALGO → USDC on Pool A by default", () => {
    const route = resolveBorrowRoute({
      networkId: NETWORK,
      collateralConfigKey: "ALGO",
      borrowConfigKey: "USDC",
    });
    expect(route).not.toBeNull();
    expect(route!.poolId).toBe(POOL_A);
    expect(route!.mechanism).toBe("pool_borrow");
  });

  it("returns multiple ALGO → WAD candidates across pools when unconstrained", () => {
    const routes = resolveBorrowRoutes({
      networkId: NETWORK,
      collateralConfigKey: "ALGO",
      borrowConfigKey: "WAD",
    });
    const poolIds = new Set(routes.map((r) => r.poolId));
    expect(poolIds.has(POOL_A)).toBe(true);
    expect(poolIds.has(POOL_B)).toBe(true);
    expect(routes[0]!.poolId).toBe(POOL_A);
  });

  it("prefers a pool the user already uses when preferredPoolIds is set", () => {
    const route = resolveBorrowRoute({
      networkId: NETWORK,
      collateralConfigKey: "ALGO",
      borrowConfigKey: "WAD",
      preferredPoolIds: [POOL_B],
    });
    expect(route!.poolId).toBe(POOL_B);
    expect(route!.mechanism).toBe("pool_borrow");
  });

  it("resolves goBTC → USDC on Pool A", () => {
    const route = resolveBorrowRoute({
      networkId: NETWORK,
      collateralConfigKey: "goBTC",
      borrowConfigKey: "USDC",
    });
    expect(route).not.toBeNull();
    expect(route!.poolId).toBe(POOL_A);
    expect(route!.mechanism).toBe("pool_borrow");
  });

  it("includes Pool D Folks USDC when resolving ALGO → USDC", () => {
    const routes = resolveBorrowRoutes({
      networkId: NETWORK,
      collateralConfigKey: "ALGO",
      borrowConfigKey: "USDC",
    });
    const labels = routes.map((r) => r.marketLabel);
    expect(labels).toContain("A");
    expect(labels).toContain("B");
    expect(labels).toContain("D");

    const poolD = routes.find((r) => r.poolId === POOL_D);
    expect(poolD).toBeTruthy();
    expect(poolD!.borrow.configKey).toBe("fUSDC");
    expect(poolD!.borrow.symbol).toBe("USDC");
    expect(poolD!.marketLabel).toBe("D");
  });

  it("prefers Pool D for ALGO → USDC when preferredPoolIds targets D", () => {
    const route = resolveBorrowRoute({
      networkId: NETWORK,
      collateralConfigKey: "ALGO",
      borrowConfigKey: "USDC",
      preferredPoolIds: [POOL_D],
    });
    expect(route!.poolId).toBe(POOL_D);
    expect(route!.marketLabel).toBe("D");
    expect(route!.borrow.symbol).toBe("USDC");
  });

  it("resolves USDC collateral on Pool D against WAD", () => {
    const routes = resolveBorrowRoutes({
      networkId: NETWORK,
      collateralConfigKey: "USDC",
      borrowConfigKey: "WAD",
    });
    const poolD = routes.find((r) => r.poolId === POOL_D);
    expect(poolD).toBeTruthy();
    expect(poolD!.collateral.configKey).toBe("fUSDC");
    expect(poolD!.collateral.symbol).toBe("USDC");
  });

  it("does not expose TINY (non-v1 borrow) in the default graph", () => {
    expect(
      resolveBorrowRoute({
        networkId: NETWORK,
        collateralConfigKey: "ALGO",
        borrowConfigKey: "TINY",
        preferredPoolIds: [POOL_B],
      })
    ).toBeNull();

    // Full graph still has it when explicitly requested.
    const full = listBorrowRoutes(NETWORK, { borrowConfigKeys: null });
    expect(
      full.some(
        (r) =>
          r.collateral.configKey === "ALGO" &&
          r.borrow.configKey === "TINY" &&
          r.poolId === POOL_B
      )
    ).toBe(true);
  });

  it("marks UNIT LP → WAD as an explicit LP route on Pool C", () => {
    const unitLp = getUnitLendingCollateralContractIds(NETWORK)[0];
    expect(unitLp).toBeTruthy();
    const wadRef = getUnitLendingWadBorrowMarketRef(NETWORK);
    expect(wadRef?.poolId).toBe(POOL_C);

    const route = resolveBorrowRoute({
      networkId: NETWORK,
      collateralConfigKey: "LP_TMPOOL2_UNIT_ALGO",
      borrowConfigKey: "WAD",
      collateralContractId: unitLp,
    });
    expect(route).not.toBeNull();
    expect(route!.poolId).toBe(POOL_C);
    expect(route!.isExplicitLpWadRoute).toBe(true);
    expect(route!.mechanism).toBe("pool_borrow");
  });

  it("exposes curated LP collateral sets for C/E/F", () => {
    expect(getUnitLendingCollateralContractIds(NETWORK).length).toBe(2);
    expect(getWadLpLendingCollateralContractIds(NETWORK).length).toBe(4);
    expect(getUsdcLpLendingCollateralContractIds(NETWORK).length).toBe(4);
  });

  it("lists Pool D USDC as its own borrow dropdown option", () => {
    const options = listBorrowAssetOptionsForCollateral(NETWORK, "ALGO");
    const keys = options.map((o) => o.uiKey);
    expect(keys).toContain("WAD");
    expect(keys).toContain("USDC");
    expect(keys).toContain(EASY_BORROW_POOL_D_USDC_UI_KEY);

    const poolD = options.find((o) => o.uiKey === EASY_BORROW_POOL_D_USDC_UI_KEY);
    expect(poolD).toBeTruthy();
    expect(poolD!.symbol).toBe("Pool D USDC");
    expect(poolD!.borrowConfigKey).toBe("USDC");
    expect(poolD!.preferredPoolIds?.[0]).toBe(POOL_D);

    const route = resolveBorrowRoute({
      networkId: NETWORK,
      collateralConfigKey: "ALGO",
      borrowConfigKey: poolD!.borrowConfigKey,
      preferredPoolIds: poolD!.preferredPoolIds,
    });
    expect(route!.poolId).toBe(POOL_D);
    expect(route!.marketLabel).toBe("D");
  });

  it("lists only WAD/USDC as borrow assets from ALGO on Pool A", () => {
    const borrowKeys = listBorrowConfigKeysForCollateral(NETWORK, "ALGO", {
      preferredPoolIds: [POOL_A],
      collateralPoolId: POOL_A,
    });
    expect(borrowKeys).toContain("WAD");
    expect(borrowKeys).toContain("USDC");
    // Pinning collateral to Pool A should not surface Pool D USDC.
    expect(borrowKeys).not.toContain(EASY_BORROW_POOL_D_USDC_UI_KEY);
    expect(borrowKeys).not.toContain("TINY");
  });

  it("includes LP collaterals that can borrow WAD", () => {
    const keys = listCollateralConfigKeys(NETWORK);
    expect(keys).toContain("ALGO");
    expect(keys).toContain("LP_TMPOOL2_UNIT_ALGO");
    expect(keys).toContain("LP_TMPOOL2_WAD_USDC");
  });

  it("returns null for completely unknown pairs", () => {
    expect(
      resolveBorrowRoute({
        networkId: NETWORK,
        collateralConfigKey: "NOT_A_TOKEN",
        borrowConfigKey: "WAD",
      })
    ).toBeNull();
  });
});
