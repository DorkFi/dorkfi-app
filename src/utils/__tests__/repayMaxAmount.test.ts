import BigNumber from "bignumber.js";
import {
  computeMaxRepayHuman,
  roundRepayHuman6,
  shouldUseRepayAllPath,
} from "@/utils/repayMaxAmount";

describe("repayMaxAmount", () => {
  const decimals = 6;

  describe("computeMaxRepayHuman", () => {
    it("returns full wallet when wallet is below debt", () => {
      expect(
        computeMaxRepayHuman({
          debtHuman: 100,
          spendableWalletHuman: 40,
          decimals,
        })
      ).toBe(40);
    });

    it("returns full debt when wallet covers debt plus repayAll surplus", () => {
      expect(
        computeMaxRepayHuman({
          debtHuman: 100,
          spendableWalletHuman: 102,
          decimals,
        })
      ).toBe(100);
    });

    it("caps below debt when wallet cannot fund repayAll surplus", () => {
      const max = computeMaxRepayHuman({
        debtHuman: 100,
        spendableWalletHuman: 100.5,
        decimals,
      });
      expect(max).toBeLessThan(100);
      expect(max).toBeGreaterThan(99);
    });

    it("reserves native txn fee from spendable", () => {
      expect(
        computeMaxRepayHuman({
          debtHuman: 10,
          spendableWalletHuman: 0.05,
          decimals,
          reserveNativeTxnFee: true,
        })
      ).toBe(0);
    });
  });

  describe("shouldUseRepayAllPath", () => {
    it("is false when amount is below debt", () => {
      expect(
        shouldUseRepayAllPath({
          amountHuman: 50,
          debtHuman: 100,
          spendableWalletHuman: 200,
          decimals,
        })
      ).toBe(false);
    });

    it("is true when repaying full debt with sufficient wallet", () => {
      expect(
        shouldUseRepayAllPath({
          amountHuman: 100,
          debtHuman: 100,
          spendableWalletHuman: 102,
          decimals,
        })
      ).toBe(true);
    });

    it("is false when full debt exceeds wallet surplus headroom", () => {
      expect(
        shouldUseRepayAllPath({
          amountHuman: 100,
          debtHuman: 100,
          spendableWalletHuman: 100.5,
          decimals,
        })
      ).toBe(false);
    });
  });

  describe("roundRepayHuman6", () => {
    it("rounds to 6 decimal places", () => {
      expect(roundRepayHuman6(1.123456789)).toBe(1.123457);
    });
  });
});
