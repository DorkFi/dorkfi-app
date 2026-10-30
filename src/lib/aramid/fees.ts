import BigNumber from "bignumber.js";
import type { AramidAmounts, AramidFeeAlternative } from "@/lib/aramid/types";

/**
 * Fee and destination amount the Aramid soldiers recompute.
 * Destination amounts round down. The fee rounds up to clear both floors.
 */
export function computeAramidAmounts(args: {
  totalAmount: string;
  sourceDecimals: number;
  destinationDecimals: number;
  fee: AramidFeeAlternative;
  /** Algorand-family routes reject a decimals shift. */
  avmToAvm: boolean;
}): AramidAmounts {
  const total = new BigNumber(args.totalAmount);
  if (!total.isFinite() || !total.isInteger() || total.lte(0)) {
    throw new Error("Enter an amount greater than zero.");
  }

  const maxNetSource = new BigNumber(
    total.dividedBy("1.001").toFixed(0, BigNumber.ROUND_DOWN)
  );
  const networkFloor = total.minus(maxNetSource);
  const sourceGuess = total.minus(networkFloor);
  const routeMin = sourceGuess
    .multipliedBy(args.fee.sourcePercent)
    .plus(args.fee.sourceConst);
  const feeAmount = BigNumber.max(networkFloor, routeMin).integerValue(
    BigNumber.ROUND_CEIL
  );
  if (feeAmount.gte(total)) {
    throw new Error("That amount is smaller than the bridge fee.");
  }
  const sourceAmount = total.minus(feeAmount);
  const minimum = new BigNumber(args.fee.minimumAmount);
  const maximum = new BigNumber(args.fee.maximumAmount);
  if (sourceAmount.lt(minimum) || sourceAmount.gt(maximum)) {
    throw new Error("That amount is outside the bridge minimum or maximum.");
  }

  const decimalsDiff = args.sourceDecimals - args.destinationDecimals;
  if (args.avmToAvm && decimalsDiff !== 0) {
    throw new Error("This route needs matching token decimals.");
  }
  const multiplier =
    decimalsDiff < 0
      ? new BigNumber(10).pow(Math.abs(decimalsDiff))
      : new BigNumber(1);
  const divider =
    decimalsDiff > 0 ? new BigNumber(10).pow(decimalsDiff) : new BigNumber(1);
  const destinationAmount = sourceAmount
    .multipliedBy(multiplier)
    .dividedBy(divider)
    .integerValue(BigNumber.ROUND_DOWN);

  return {
    totalAmount: total.toFixed(0),
    feeAmount: feeAmount.toFixed(0),
    sourceAmount: sourceAmount.toFixed(0),
    destinationAmount: destinationAmount.toFixed(0),
  };
}

export function humanToBaseUnits(amount: string, decimals: number): string {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter an amount greater than zero.");
  }
  const base = new BigNumber(trimmed).shiftedBy(decimals);
  if (!base.isFinite() || base.lte(0)) {
    throw new Error("Enter an amount greater than zero.");
  }
  if (!base.isInteger()) {
    throw new Error("That amount has too many decimal places.");
  }
  return base.toFixed(0);
}

export function baseUnitsToHuman(amount: string, decimals: number): string {
  const human = new BigNumber(amount).shiftedBy(-decimals);
  if (!human.isFinite()) return "0";
  return human.toFixed(Math.min(decimals, 6)).replace(/\.?0+$/, "") || "0";
}
