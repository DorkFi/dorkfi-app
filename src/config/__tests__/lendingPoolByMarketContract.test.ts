import { describe, expect, it } from "vitest";
import {
  getLendingPoolIdForMarketContract,
  getPoolCMarketContractIds,
  getPoolCLendingPoolId,
  getPoolELendingPoolId,
  getUnitLendingCollateralContractIds,
  getUnitLendingWadBorrowMarketConfig,
  getUnitLendingWadBorrowMarketRef,
  getWadLpLendingCollateralContractIds,
  getWadLpLendingWadBorrowMarketConfig,
  getWadLpLendingWadBorrowMarketRef,
  getWadSupplyMarketConfigsExcludingPoolCBorrow,
  isPoolCMarketContract,
  isUnitLpCollateralMarketContract,
  isWadLpCollateralMarketContract,
} from "@/config";

const POOL_C = "3578814346";
const POOL_E = "3585829377";
const WAD_STOKEN = "3333688448";
const WAD_NTOKEN_POOL_C = "3583297246";
const WAD_NTOKEN_POOL_E = "3585972631";
const LP_UNIT_ALGO = "3577729953";
const LP_UNIT_GOBTC = "3577777819";
const LP_WAD_UNIT = "3577783311";

describe("LENDING_POOL_BY_MARKET_CONTRACT", () => {
  it("returns Pool C and Pool E ids for algorand-mainnet", () => {
    expect(getPoolCLendingPoolId("algorand-mainnet")).toBe(POOL_C);
    expect(getPoolELendingPoolId("algorand-mainnet")).toBe(POOL_E);
  });

  it("maps WAD SToken and TMPOOL2 nt200 contracts to Pool C", () => {
    for (const contractId of [
      WAD_STOKEN,
      LP_UNIT_ALGO,
      LP_UNIT_GOBTC,
      LP_WAD_UNIT,
    ]) {
      expect(
        getLendingPoolIdForMarketContract("algorand-mainnet", contractId)
      ).toBe(POOL_C);
      expect(
        isPoolCMarketContract("algorand-mainnet", contractId)
      ).toBe(true);
    }
  });

  it("returns null for unknown contract ids", () => {
    expect(
      getLendingPoolIdForMarketContract("algorand-mainnet", "9999999999")
    ).toBeNull();
    expect(isPoolCMarketContract("algorand-mainnet", "9999999999")).toBe(
      false
    );
  });

  it("lists all Pool C market contract ids", () => {
    expect(getPoolCMarketContractIds("algorand-mainnet").sort()).toEqual(
      [WAD_STOKEN, LP_UNIT_ALGO, LP_UNIT_GOBTC, LP_WAD_UNIT].sort()
    );
  });

  it("points WAD LP collateral at WAD @ Pool E (tokens.WAD row)", () => {
    expect(getWadLpLendingWadBorrowMarketRef("algorand-mainnet")).toEqual({
      poolId: POOL_E,
      contractId: WAD_STOKEN,
      nTokenId: WAD_NTOKEN_POOL_E,
      configKey: "WAD",
    });

    const wadMarket = getWadLpLendingWadBorrowMarketConfig("algorand-mainnet");
    expect(wadMarket).toMatchObject({
      poolId: POOL_E,
      contractId: WAD_STOKEN,
      nTokenId: WAD_NTOKEN_POOL_E,
      symbol: "WAD",
    });
  });

  it("maps Pool E WAD TMPOOL2 nt200 contracts to Pool E", () => {
    for (const contractId of getWadLpLendingCollateralContractIds(
      "algorand-mainnet"
    )) {
      expect(
        getLendingPoolIdForMarketContract("algorand-mainnet", contractId)
      ).toBe(POOL_E);
    }
  });
});

describe("UNIT lending → Pool C WAD borrow market", () => {
  it("registers UNIT LP collateral nt200 ids", () => {
    expect(getUnitLendingCollateralContractIds("algorand-mainnet")).toEqual([
      LP_UNIT_ALGO,
      LP_UNIT_GOBTC,
    ]);
    expect(
      isUnitLpCollateralMarketContract("algorand-mainnet", LP_UNIT_ALGO)
    ).toBe(true);
    expect(
      isUnitLpCollateralMarketContract("algorand-mainnet", LP_WAD_UNIT)
    ).toBe(false);
  });

  it("points UNIT collateral at WAD @ Pool C (tokens.WAD row)", () => {
    expect(getUnitLendingWadBorrowMarketRef("algorand-mainnet")).toEqual({
      poolId: POOL_C,
      contractId: WAD_STOKEN,
      nTokenId: WAD_NTOKEN_POOL_C,
      configKey: "WAD",
    });

    const wadMarket = getUnitLendingWadBorrowMarketConfig("algorand-mainnet");
    expect(wadMarket).toMatchObject({
      poolId: POOL_C,
      contractId: WAD_STOKEN,
      nTokenId: WAD_NTOKEN_POOL_C,
      symbol: "WAD",
    });
  });

  it("lists WAD supply markets excluding Pool C borrow row", () => {
    const supplyMarkets =
      getWadSupplyMarketConfigsExcludingPoolCBorrow("algorand-mainnet");
    expect(supplyMarkets.length).toBeGreaterThan(0);
    expect(
      supplyMarkets.every(
        (config) =>
          String(config.poolId) !== POOL_C && config.isStoken !== true
      )
    ).toBe(true);
    expect(
      supplyMarkets.some((config) => String(config.poolId) === "3345940978")
    ).toBe(true);
  });
});
