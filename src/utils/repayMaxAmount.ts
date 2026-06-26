import BigNumber from "bignumber.js";

/** Fee set on lending repay / repayAll groups (`ci.setFee(1e5)`). */
export const REPAY_LENDING_GROUP_FEE_MICRO = 100_000n;

/** 1% + 1 atomic unit buffer used by repayAll deposit/approve sizing. */
export function repayAllSurplusAtomic(amountAtomic: bigint): bigint {
  if (amountAtomic <= 0n) return 0n;
  return amountAtomic / 100n + 1n;
}

/** Total deposit/approve units when repayAll adds its surplus on a base amount. */
export function repayAllDepositAtomicFromBase(baseAtomic: bigint): bigint {
  if (baseAtomic <= 0n) return 0n;
  return baseAtomic + repayAllSurplusAtomic(baseAtomic);
}

/**
 * Largest base (debt) amount such that `base + surplus(base)` fits in `spendableAtomic`.
 */
export function maxBaseAtomicForRepayAllSurplus(
  spendableAtomic: bigint
): bigint {
  if (spendableAtomic <= 1n) return 0n;
  return ((spendableAtomic - 1n) * 100n) / 101n;
}

export function humanToRepayAtomic(human: number, decimals: number): bigint {
  if (!(human > 0) || !Number.isFinite(human)) return 0n;
  return BigInt(
    new BigNumber(human)
      .times(10 ** decimals)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toFixed(0)
  );
}

export function repayAtomicToHuman(atomic: bigint, decimals: number): number {
  return Number(atomic) / 10 ** decimals;
}

export function roundRepayHuman6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export type ComputeMaxRepayHumanParams = {
  debtHuman: number;
  spendableWalletHuman: number;
  decimals: number;
  /** When true, subtract {@link REPAY_LENDING_GROUP_FEE_MICRO} from native-coin spendable. */
  reserveNativeTxnFee?: boolean;
};

/**
 * Max repay input (human units): all spendable wallet up to debt, with repayAll surplus
 * and native txn fee headroom when closing the full position.
 */
export function computeMaxRepayHuman({
  debtHuman,
  spendableWalletHuman,
  decimals,
  reserveNativeTxnFee = false,
}: ComputeMaxRepayHumanParams): number {
  if (!(debtHuman > 0) || !(spendableWalletHuman > 0)) return 0;

  let spendableAtomic = humanToRepayAtomic(spendableWalletHuman, decimals);
  if (spendableAtomic <= 0n) return 0;

  if (reserveNativeTxnFee) {
    if (spendableAtomic <= REPAY_LENDING_GROUP_FEE_MICRO) return 0;
    spendableAtomic -= REPAY_LENDING_GROUP_FEE_MICRO;
  }

  const debtAtomic = humanToRepayAtomic(debtHuman, decimals);
  if (debtAtomic <= 0n) return 0;

  let maxAtomic: bigint;
  if (spendableAtomic < debtAtomic) {
    maxAtomic = spendableAtomic;
  } else {
    const depositForFullDebt = repayAllDepositAtomicFromBase(debtAtomic);
    if (depositForFullDebt <= spendableAtomic) {
      maxAtomic = debtAtomic;
    } else {
      maxAtomic = maxBaseAtomicForRepayAllSurplus(spendableAtomic);
      if (maxAtomic > debtAtomic) maxAtomic = debtAtomic;
    }
  }

  if (maxAtomic <= 0n) return 0;
  return roundRepayHuman6(repayAtomicToHuman(maxAtomic, decimals));
}

export type ShouldUseRepayAllPathParams = {
  amountHuman: number;
  debtHuman: number;
  spendableWalletHuman: number;
  decimals: number;
  reserveNativeTxnFee?: boolean;
};

/** True when amount equals full debt and wallet can fund repayAll deposit/approve sizing. */
export function shouldUseRepayAllPath({
  amountHuman,
  debtHuman,
  spendableWalletHuman,
  decimals,
  reserveNativeTxnFee = false,
}: ShouldUseRepayAllPathParams): boolean {
  const roundedAmount = roundRepayHuman6(amountHuman);
  const roundedDebt = roundRepayHuman6(debtHuman);
  if (roundedAmount !== roundedDebt || roundedDebt <= 0) return false;

  let spendableAtomic = humanToRepayAtomic(spendableWalletHuman, decimals);
  if (spendableAtomic <= 0n) return false;

  if (reserveNativeTxnFee) {
    if (spendableAtomic <= REPAY_LENDING_GROUP_FEE_MICRO) return false;
    spendableAtomic -= REPAY_LENDING_GROUP_FEE_MICRO;
  }

  const debtAtomic = humanToRepayAtomic(roundedDebt, decimals);
  if (debtAtomic <= 0n) return false;

  return repayAllDepositAtomicFromBase(debtAtomic) <= spendableAtomic;
}

/**
 * repayAll deposit/approve units: on-chain debt + surplus, capped at spendable wallet.
 */
export function computeRepayAllArc200Units(params: {
  onChainBorrowAtomic: bigint;
  spendableWalletAtomic: bigint;
  reserveNativeTxnFee?: boolean;
}): bigint {
  const { onChainBorrowAtomic, reserveNativeTxnFee = false } = params;
  let spendable = params.spendableWalletAtomic;

  if (onChainBorrowAtomic <= 0n) {
    throw new Error("No outstanding borrow to repay");
  }
  if (spendable <= 0n) {
    throw new Error("Insufficient wallet balance to repay");
  }

  if (reserveNativeTxnFee) {
    if (spendable <= REPAY_LENDING_GROUP_FEE_MICRO) {
      throw new Error("Insufficient ALGO for repay transaction fee");
    }
    spendable -= REPAY_LENDING_GROUP_FEE_MICRO;
  }

  if (spendable < onChainBorrowAtomic) {
    throw new Error(
      "Insufficient balance to close full debt; try a smaller repay amount"
    );
  }

  const target = repayAllDepositAtomicFromBase(onChainBorrowAtomic);
  return target <= spendable ? target : spendable;
}
