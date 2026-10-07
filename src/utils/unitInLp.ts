import BigNumber from "bignumber.js";
import {
  UNIT_ASA_ID,
  pairContainsUnit,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";

/** Snapshot fields needed to index UNIT inside an LP amount. */
export type UnitLpReserveSnapshot = {
  pair: Pick<LiquidityPoolPairConfig, "asset1Id" | "asset2Id">;
  issuedLpAtomic: bigint;
  asset1ReserveAtomic: bigint;
  asset2ReserveAtomic: bigint;
  asset1Decimals: number;
  asset2Decimals: number;
};

export type UnitInLpAmount = {
  unitAtomic: bigint;
  unitDecimals: number;
  unitHuman: number;
};

/**
 * UNIT atomic amount represented by `lpAmountAtomic` of an LP token.
 * `floor(lp * unitReserve / issuedLp)` — the user's share of the UNIT side.
 */
export function unitAtomicInLpAmount(
  lpAmountAtomic: bigint,
  issuedLpAtomic: bigint,
  unitReserveAtomic: bigint
): bigint {
  if (lpAmountAtomic <= 0n || issuedLpAtomic <= 0n || unitReserveAtomic <= 0n) {
    return 0n;
  }
  return (lpAmountAtomic * unitReserveAtomic) / issuedLpAtomic;
}

export function unitHumanFromAtomic(
  unitAtomic: bigint,
  unitDecimals: number
): number {
  if (unitAtomic <= 0n) return 0;
  return new BigNumber(unitAtomic.toString())
    .shiftedBy(-unitDecimals)
    .toNumber();
}

/** UNIT reserve (atomic) for a UNIT-containing pair snapshot, or null. */
export function unitReserveFromSnapshot(
  snapshot: UnitLpReserveSnapshot
): { unitReserveAtomic: bigint; unitDecimals: number } | null {
  if (!pairContainsUnit(snapshot.pair)) return null;
  if (snapshot.pair.asset1Id === UNIT_ASA_ID) {
    return {
      unitReserveAtomic: snapshot.asset1ReserveAtomic,
      unitDecimals: snapshot.asset1Decimals,
    };
  }
  return {
    unitReserveAtomic: snapshot.asset2ReserveAtomic,
    unitDecimals: snapshot.asset2Decimals,
  };
}

/** UNIT contained in an LP amount we index (deposited nToken, wallet LP, etc). */
export function unitInLpAmount(
  snapshot: UnitLpReserveSnapshot,
  lpAmountAtomic: bigint
): UnitInLpAmount | null {
  const reserve = unitReserveFromSnapshot(snapshot);
  if (!reserve) return null;
  const unitAtomic = unitAtomicInLpAmount(
    lpAmountAtomic,
    snapshot.issuedLpAtomic,
    reserve.unitReserveAtomic
  );
  return {
    unitAtomic,
    unitDecimals: reserve.unitDecimals,
    unitHuman: unitHumanFromAtomic(unitAtomic, reserve.unitDecimals),
  };
}
