import { describe, expect, it } from "vitest";
import { CURATED_LIQUIDITY_POOLS } from "@/constants/liquidityPools";
import {
  deployedUnitLpPowerAdapters,
  TINYMAN_V2_VALIDATOR_APP_ID,
  UNIT_ASA_ID,
  UNIT_LP_POWER_ADAPTERS,
  UNIT_LP_POWER_MULTIPLIER,
  UNIT_LP_POWER_SUPPORTED_MODES,
  unitLpPowerCreateArgs,
} from "@/constants/unitLpPowerSource";

function pairById(id: string) {
  const pair = CURATED_LIQUIDITY_POOLS.find((p) => p.id === id);
  if (!pair) throw new Error(`Missing curated pair: ${id}`);
  return pair;
}

describe("unitLpPowerCreateArgs", () => {
  it("uses nt200 + Tinyman pool + UNIT ASA for UNIT/ALGO", () => {
    expect(unitLpPowerCreateArgs(pairById("unit-algo"))).toEqual({
      ntokenAppId: 3577729953,
      poolAddress: "5T5VBTBOPW2ZRJX6QJYCBMZ24VAW7IWFGV7GHCBKFNKIN2XYHP5OLOSQJQ",
      unitAssetId: UNIT_ASA_ID,
      validatorAppId: TINYMAN_V2_VALIDATOR_APP_ID,
    });
  });

  it("uses the WAD/UNIT pool when UNIT is asset 2", () => {
    const args = unitLpPowerCreateArgs(pairById("wad-unit"));
    expect(args.ntokenAppId).toBe(3577783311);
    expect(args.unitAssetId).toBe(UNIT_ASA_ID);
  });
});

describe("deployedUnitLpPowerAdapters", () => {
  it("is empty until converter app ids are filled in", () => {
    expect(UNIT_LP_POWER_ADAPTERS.every((a) => a.appId == null)).toBe(true);
    expect(deployedUnitLpPowerAdapters()).toEqual([]);
  });
});

describe("UNIT LP power source registration params", () => {
  it("matches live UNIT nToken get_power_source (10000, 1)", () => {
    expect(UNIT_LP_POWER_MULTIPLIER).toBe(10000);
    expect(UNIT_LP_POWER_SUPPORTED_MODES).toBe(1);
  });
});
