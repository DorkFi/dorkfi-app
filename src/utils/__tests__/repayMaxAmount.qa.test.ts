/**
 * QA / smoke scenarios for Max Repay (#501).
 * Mirrors Algorand market decimals and reported user flows.
 */
import { describe, expect, it } from "vitest";
import {
  computeMaxRepayHuman,
  computeRepayAllArc200Units,
  humanToRepayAtomic,
  repayAllDepositAtomicFromBase,
  repayAllSurplusAtomic,
  shouldUseRepayAllPath,
} from "@/utils/repayMaxAmount";

const D6 = 6;
const D8 = 8;

describe("repayMaxAmount QA smoke scenarios", () => {
  describe("issue #501 — wallet-limited partial max (wallet < debt)", () => {
    it("ALGO: wallet 40, debt 100 → max spendable minus txn fee, repay() path", () => {
      const max = computeMaxRepayHuman({
        debtHuman: 100,
        spendableWalletHuman: 40,
        decimals: D6,
        reserveNativeTxnFee: true,
      });
      // 40 spendable − 0.1 ALGO group fee reserve
      expect(max).toBe(39.9);
      expect(
        shouldUseRepayAllPath({
          amountHuman: max,
          debtHuman: 100,
          spendableWalletHuman: 40,
          decimals: D6,
          reserveNativeTxnFee: true,
        })
      ).toBe(false);
    });

    it("UNIT (8 dec): wallet 0.5, debt 2 → max 0.5", () => {
      const max = computeMaxRepayHuman({
        debtHuman: 2,
        spendableWalletHuman: 0.5,
        decimals: D8,
      });
      expect(max).toBe(0.5);
    });
  });

  describe("issue #501 — exact-balance full close failure mode (fixed)", () => {
    it("ALGO: wallet equals debt — old bug used repayAll with surplus overflow", () => {
      const debt = 50;
      const wallet = 50;
      const max = computeMaxRepayHuman({
        debtHuman: debt,
        spendableWalletHuman: wallet,
        decimals: D6,
        reserveNativeTxnFee: true,
      });
      // Cannot fund debt + 1% + fee with only 50 spendable
      expect(max).toBeLessThan(debt);
      expect(
        shouldUseRepayAllPath({
          amountHuman: max,
          debtHuman: debt,
          spendableWalletHuman: wallet,
          decimals: D6,
          reserveNativeTxnFee: true,
        })
      ).toBe(false);
    });

    it("ALGO: wallet 50.2, debt 50 — not enough for full close (fee + surplus)", () => {
      const debt = 50;
      const wallet = 50.2;
      const max = computeMaxRepayHuman({
        debtHuman: debt,
        spendableWalletHuman: wallet,
        decimals: D6,
        reserveNativeTxnFee: true,
      });
      // Need ~50.6 spendable for debt + 1% surplus + 0.1 fee; caps below debt
      expect(max).toBeLessThan(debt);
      expect(
        shouldUseRepayAllPath({
          amountHuman: max,
          debtHuman: debt,
          spendableWalletHuman: wallet,
          decimals: D6,
          reserveNativeTxnFee: true,
        })
      ).toBe(false);
    });

    it("ALGO: wallet 51, debt 50 — enough headroom for full close", () => {
      const debt = 50;
      const wallet = 51;
      const max = computeMaxRepayHuman({
        debtHuman: debt,
        spendableWalletHuman: wallet,
        decimals: D6,
        reserveNativeTxnFee: true,
      });
      expect(max).toBe(50);
      expect(
        shouldUseRepayAllPath({
          amountHuman: max,
          debtHuman: debt,
          spendableWalletHuman: wallet,
          decimals: D6,
          reserveNativeTxnFee: true,
        })
      ).toBe(true);
    });
  });

  describe("repayAll on-chain sizing", () => {
    it("never requests more than spendable wallet", () => {
      const onChain = 100_000_000n; // 100 ALGO
      const wallet = 100_500_000n; // 100.5 ALGO
      const units = computeRepayAllArc200Units({
        onChainBorrowAtomic: onChain,
        spendableWalletAtomic: wallet,
        reserveNativeTxnFee: true,
      });
      expect(units).toBeLessThanOrEqual(wallet - 100_000n);
      expect(units).toBeGreaterThanOrEqual(onChain);
    });

    it("throws when wallet cannot cover on-chain debt", () => {
      expect(() =>
        computeRepayAllArc200Units({
          onChainBorrowAtomic: 100_000_000n,
          spendableWalletAtomic: 50_000_000n,
        })
      ).toThrow(/Insufficient balance to close full debt/);
    });

    it("surplus formula matches repayAll implementation (1% + 1)", () => {
      const base = 1_000_000n;
      expect(repayAllSurplusAtomic(base)).toBe(10_000n + 1n);
      expect(repayAllDepositAtomicFromBase(base)).toBe(1_010_001n);
    });
  });

  describe("regression — Voi-style headroom (no native fee reserve)", () => {
    it("arc200: wallet 102, debt 100 → full close via repayAll", () => {
      const max = computeMaxRepayHuman({
        debtHuman: 100,
        spendableWalletHuman: 102,
        decimals: D6,
      });
      expect(max).toBe(100);
      expect(
        shouldUseRepayAllPath({
          amountHuman: 100,
          debtHuman: 100,
          spendableWalletHuman: 102,
          decimals: D6,
        })
      ).toBe(true);
    });
  });

  describe("atomic round-trip sanity", () => {
    it("humanToRepayAtomic floors partial micro units", () => {
      expect(humanToRepayAtomic(1.0000009, D6)).toBe(1_000_000n);
    });
  });
});
