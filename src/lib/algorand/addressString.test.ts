import { describe, expect, it } from "vitest";
import algosdk from "algosdk";
import {
  asAlgorandAddressString,
  coerceTxnAddressFields,
  requireAlgorandAddressString,
} from "@/lib/algorand/addressString";

const addr = algosdk.encodeAddress(new Uint8Array(32).fill(7));

describe("asAlgorandAddressString", () => {
  it("keeps a valid address string", () => {
    expect(asAlgorandAddressString(addr)).toBe(addr);
  });

  it("accepts an algosdk Address object via toString", () => {
    expect(asAlgorandAddressString(algosdk.Address.fromString(addr))).toBe(
      addr
    );
  });

  it("accepts a foreign Address-like object (failed instanceof)", () => {
    expect(asAlgorandAddressString({ toString: () => addr })).toBe(addr);
  });

  it("rejects truncated base32", () => {
    expect(
      asAlgorandAddressString("2XDOTFFNYX2ZAJUG3NV7HUVGQTCVR6GJSMC7EJ38")
    ).toBeUndefined();
  });
});

describe("coerceTxnAddressFields", () => {
  it("stringifies sender, receiver, and accounts", () => {
    const foreign = { toString: () => addr };
    const out = coerceTxnAddressFields({
      sender: foreign,
      receiver: foreign,
      accounts: [foreign, addr],
      amount: 1,
    });
    expect(out.sender).toBe(addr);
    expect(out.receiver).toBe(addr);
    expect(out.accounts).toEqual([addr, addr]);
    expect(out.amount).toBe(1);
  });
});

describe("algosdk wrapper", () => {
  it("lets makePaymentTxn accept a foreign Address-like sender", () => {
    const foreign = { toString: () => addr };
    const suggestedParams = {
      fee: 1000,
      firstValid: 1,
      lastValid: 1000,
      genesisHash: new Uint8Array(32).fill(1),
      genesisID: "test",
      minFee: 1000,
    };
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: foreign as unknown as string,
      receiver: foreign as unknown as string,
      amount: 1,
      suggestedParams,
    });
    expect(txn.sender.toString()).toBe(addr);
  });
});

describe("requireAlgorandAddressString", () => {
  it("throws on invalid input", () => {
    expect(() => requireAlgorandAddressString("not-an-address")).toThrow(
      /Not a valid Algorand/
    );
  });
});
