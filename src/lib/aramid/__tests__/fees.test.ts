import { describe, expect, it } from "vitest";
import { baseUnitsToHuman, computeAramidAmounts, humanToBaseUnits } from "@/lib/aramid/fees";
import type { AramidFeeAlternative } from "@/lib/aramid/types";

const fee: AramidFeeAlternative = {
  validFrom: 0,
  validUntil: 999999999,
  minimumAmount: "1",
  maximumAmount: "999999999000000",
  sourceConst: 0,
  sourcePercent: 0.001,
  destinationConst: 0,
  destinationPercent: 0,
  ifPremiumTokenUsed: false,
};

describe("computeAramidAmounts", () => {
  it("matches the 1 ALGO worked example", () => {
    const amounts = computeAramidAmounts({
      totalAmount: "1000000",
      sourceDecimals: 6,
      destinationDecimals: 6,
      fee,
      avmToAvm: true,
    });
    expect(amounts.feeAmount).toBe("1000");
    expect(amounts.sourceAmount).toBe("999000");
    expect(amounts.destinationAmount).toBe("999000");
  });

  it("shifts decimals down for an EVM destination", () => {
    const amounts = computeAramidAmounts({
      totalAmount: "1000000",
      sourceDecimals: 6,
      destinationDecimals: 18,
      fee,
      avmToAvm: false,
    });
    expect(amounts.sourceAmount).toBe("999000");
    expect(amounts.destinationAmount).toBe(`${999000n * 10n ** 12n}`);
  });

  it("rejects an AVM route whose decimals differ", () => {
    expect(() =>
      computeAramidAmounts({
        totalAmount: "1000000",
        sourceDecimals: 6,
        destinationDecimals: 8,
        fee,
        avmToAvm: true,
      })
    ).toThrow(/decimals/);
  });
});

describe("human amounts", () => {
  it("converts display units both ways", () => {
    expect(humanToBaseUnits("1.5", 6)).toBe("1500000");
    expect(baseUnitsToHuman("1500000", 6)).toBe("1.5");
  });
});
