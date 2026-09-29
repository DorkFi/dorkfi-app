import { describe, expect, it } from "vitest";
import {
  isAlgoCreditArrived,
  isBaseCreditArrived,
  isXoOrderFailed,
  isXoOrderSettled,
} from "@/lib/easyStart/xoSwap/settle";

describe("isXoOrderSettled", () => {
  it("accepts complete and a payout tx id", () => {
    expect(isXoOrderSettled({ status: "complete" })).toBe(true);
    expect(isXoOrderSettled({ status: "COMPLETED" })).toBe(true);
    expect(
      isXoOrderSettled({ status: "delayed", toTransactionId: "ABC123" })
    ).toBe(true);
    expect(isXoOrderSettled({ status: "inProgress" })).toBe(false);
    expect(isXoOrderSettled({ status: "delayed" })).toBe(false);
  });
});

describe("isXoOrderFailed", () => {
  it("treats failed expired refunded as terminal", () => {
    expect(isXoOrderFailed({ status: "failed" })).toBe(true);
    expect(isXoOrderFailed({ status: "expired" })).toBe(true);
    expect(isXoOrderFailed({ status: "refunded" })).toBe(true);
    expect(isXoOrderFailed({ status: "delayed" })).toBe(false);
  });
});

describe("isAlgoCreditArrived", () => {
  it("requires most of the quoted Exodus output", () => {
    expect(
      isAlgoCreditArrived({
        current: 59.34,
        baseline: 29.05,
        expectedToAmount: 30.28,
      })
    ).toBe(true);
    expect(
      isAlgoCreditArrived({
        current: 29.05,
        baseline: 29.05,
        expectedToAmount: 30.28,
      })
    ).toBe(false);
    expect(
      isAlgoCreditArrived({
        current: 29.06,
        baseline: 29.05,
        expectedToAmount: 30.28,
      })
    ).toBe(false);
  });
});

describe("isBaseCreditArrived", () => {
  it("uses the same threshold as an Algorand credit", () => {
    expect(
      isBaseCreditArrived({
        current: 40.2,
        baseline: 10,
        expectedToAmount: 30.28,
      })
    ).toBe(true);
    expect(
      isBaseCreditArrived({
        current: 10.02,
        baseline: 10,
        expectedToAmount: 30.28,
      })
    ).toBe(false);
  });
});
