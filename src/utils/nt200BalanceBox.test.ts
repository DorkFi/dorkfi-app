import { describe, expect, it } from "vitest";
import {
  classifyNt200CreateBalanceBoxSimulateResult,
  isNt200CreateBalanceBoxAlreadyExistsError,
} from "./nt200BalanceBox";

describe("nt200BalanceBox", () => {
  it("detects createBalanceBox already-exists assert", () => {
    const msg =
      "TransactionPool.Remember: transaction DKLDDLCGSZJS…: logic eval error: assert failed pc=886. Details: app=3220125024, opcodes=intc_0 // 0; ==; assert";
    expect(isNt200CreateBalanceBoxAlreadyExistsError(msg)).toBe(true);
    expect(
      isNt200CreateBalanceBoxAlreadyExistsError(
        "logic eval error: assert failed pc=1. Details: app=1, opcodes=b/; b<=; assert"
      )
    ).toBe(false);
  });

  it("detects explicit box-exists text", () => {
    expect(
      isNt200CreateBalanceBoxAlreadyExistsError("err box already exists")
    ).toBe(true);
  });

  it("classifies simulate success as missing", () => {
    expect(
      classifyNt200CreateBalanceBoxSimulateResult({ success: true })
    ).toBe("missing");
  });

  it("classifies already-exists assert as present", () => {
    expect(
      classifyNt200CreateBalanceBoxSimulateResult({
        success: false,
        error:
          "logic eval error: assert failed pc=886. Details: app=3220125024, opcodes=intc_0 // 0; ==; assert",
      })
    ).toBe("present");
  });

  it("classifies other failures as unknown", () => {
    expect(
      classifyNt200CreateBalanceBoxSimulateResult({
        success: false,
        error: "overspend",
      })
    ).toBe("unknown");
  });
});
