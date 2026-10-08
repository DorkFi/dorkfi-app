import { describe, expect, it } from "vitest";
import { UNIT_ASA_ID, pairContainsUnit } from "@/constants/liquidityPools";
import {
  unitAtomicInLpAmount,
  unitHumanFromAtomic,
  unitInLpAmount,
  unitReserveFromSnapshot,
  type UnitLpReserveSnapshot,
} from "@/utils/unitInLp";

const UNIT_DECIMALS = 8;
const LP_DECIMALS = 6;
const GOBTC = 386192725;
const WAD = 3334160924;
const USDC = 31566704;

function snapshot(partial: {
  asset1Id: number;
  asset2Id: number;
  issuedLpHuman?: number;
  asset1Human?: number;
  asset2Human?: number;
  asset1Decimals?: number;
  asset2Decimals?: number;
}): UnitLpReserveSnapshot {
  const a1d = partial.asset1Decimals ?? (partial.asset1Id === UNIT_ASA_ID ? UNIT_DECIMALS : 6);
  const a2d = partial.asset2Decimals ?? (partial.asset2Id === UNIT_ASA_ID ? UNIT_DECIMALS : 6);
  const lp = BigInt(Math.round((partial.issuedLpHuman ?? 1000) * 10 ** LP_DECIMALS));
  const a1 = BigInt(Math.round((partial.asset1Human ?? 0) * 10 ** a1d));
  const a2 = BigInt(Math.round((partial.asset2Human ?? 0) * 10 ** a2d));
  return {
    pair: { asset1Id: partial.asset1Id, asset2Id: partial.asset2Id },
    issuedLpAtomic: lp,
    asset1ReserveAtomic: a1,
    asset2ReserveAtomic: a2,
    asset1Decimals: a1d,
    asset2Decimals: a2d,
  };
}

describe("pairContainsUnit", () => {
  it("is true for UNIT/ALGO, UNIT/goBTC, and WAD/UNIT", () => {
    expect(pairContainsUnit({ asset1Id: UNIT_ASA_ID, asset2Id: 0 })).toBe(true);
    expect(pairContainsUnit({ asset1Id: UNIT_ASA_ID, asset2Id: GOBTC })).toBe(
      true
    );
    expect(pairContainsUnit({ asset1Id: WAD, asset2Id: UNIT_ASA_ID })).toBe(
      true
    );
  });

  it("is false for USDC/ALGO", () => {
    expect(pairContainsUnit({ asset1Id: USDC, asset2Id: 0 })).toBe(false);
  });
});

describe("unitAtomicInLpAmount", () => {
  it("returns the LP share of the UNIT reserve", () => {
    // 1000 LP, 500 UNIT in reserve, 100 LP → 50 UNIT (8 decimals)
    const issued = 1000n * 10n ** BigInt(LP_DECIMALS);
    const unitReserve = 500n * 10n ** BigInt(UNIT_DECIMALS);
    const lpAmount = 100n * 10n ** BigInt(LP_DECIMALS);
    expect(unitAtomicInLpAmount(lpAmount, issued, unitReserve)).toBe(
      50n * 10n ** BigInt(UNIT_DECIMALS)
    );
  });

  it("floors leftover atomic units", () => {
    expect(unitAtomicInLpAmount(1n, 3n, 10n)).toBe(3n);
  });

  it("returns 0 when supply or amount is zero", () => {
    expect(unitAtomicInLpAmount(0n, 100n, 50n)).toBe(0n);
    expect(unitAtomicInLpAmount(10n, 0n, 50n)).toBe(0n);
    expect(unitAtomicInLpAmount(10n, 100n, 0n)).toBe(0n);
  });
});

describe("unitInLpAmount", () => {
  it("indexes UNIT on asset1 (UNIT/ALGO)", () => {
    const snap = snapshot({
      asset1Id: UNIT_ASA_ID,
      asset2Id: 0,
      issuedLpHuman: 1000,
      asset1Human: 800,
      asset2Human: 200,
    });
    const lp = 250n * 10n ** BigInt(LP_DECIMALS);
    const result = unitInLpAmount(snap, lp);
    expect(result?.unitHuman).toBe(200);
    expect(result?.unitDecimals).toBe(UNIT_DECIMALS);
  });

  it("indexes UNIT on asset2 (WAD/UNIT)", () => {
    const snap = snapshot({
      asset1Id: WAD,
      asset2Id: UNIT_ASA_ID,
      issuedLpHuman: 50,
      asset1Human: 100,
      asset2Human: 40,
    });
    const lp = 25n * 10n ** BigInt(LP_DECIMALS);
    const result = unitInLpAmount(snap, lp);
    expect(result?.unitHuman).toBe(20);
  });

  it("returns null when the pair has no UNIT", () => {
    const snap = snapshot({
      asset1Id: USDC,
      asset2Id: 0,
      issuedLpHuman: 100,
      asset1Human: 50,
      asset2Human: 50,
    });
    expect(unitReserveFromSnapshot(snap)).toBeNull();
    expect(unitInLpAmount(snap, 10n)).toBeNull();
  });
});

describe("unitHumanFromAtomic", () => {
  it("shifts UNIT 8-decimal atomics to human", () => {
    expect(unitHumanFromAtomic(12_500_000n, 8)).toBe(0.125);
  });
});
