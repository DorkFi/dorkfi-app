import { describe, expect, it } from "vitest";
import {
  isNt200CreateBalanceBoxAlreadyExistsError,
  nt200UserBalanceBoxName,
} from "./nt200BalanceBox";
import algosdk from "algosdk";

describe("nt200BalanceBox", () => {
  it("builds 0x00 || pubkey box names", () => {
    const addr =
      "CRI5WQWSLYN7TT4LNJYWHK4LICMOX6QR6HCSSTOG3TVNWFG2HB4G2EKIQQ";
    const name = nt200UserBalanceBoxName(addr);
    expect(name).toHaveLength(33);
    expect(name[0]).toBe(0);
    expect(name.subarray(1)).toEqual(
      algosdk.decodeAddress(addr).publicKey
    );
  });

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
});
