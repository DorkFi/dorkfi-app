import { describe, expect, it } from "vitest";
import algosdk from "algosdk";
import nacl from "tweetnacl";
import {
  bytesToHex,
  signAlgorandGroupWithEd25519,
  signatureHexToBytes,
  signatureToBytes,
} from "@/wallet/algorandGroupSign";

const suggestedParams = {
  fee: 1000,
  firstValid: 1,
  lastValid: 1000,
  genesisHash: new Uint8Array(32).fill(1),
  genesisID: "test",
  minFee: 1000,
};

function groupedPayments(address: string) {
  const first = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 1,
    suggestedParams,
  });
  const second = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 2,
    suggestedParams,
  });
  algosdk.assignGroupID([first, second]);
  return [first, second];
}

describe("signAlgorandGroupWithEd25519", () => {
  it("signs each requested transaction over the full group's bytes", async () => {
    const key = nacl.sign.keyPair();
    const address = algosdk.encodeAddress(key.publicKey);
    const [first, second] = groupedPayments(address);
    const seen: Uint8Array[] = [];

    const signed = await signAlgorandGroupWithEd25519({
      signerAddress: address,
      txnGroup: [first, second],
      indexesToSign: [1, 0],
      signBytes: async (message) => {
        seen.push(message);
        return nacl.sign.detached(message, key.secretKey);
      },
    });

    expect(signed).toHaveLength(2);
    expect(Buffer.from(seen[0]!).equals(Buffer.from(second.bytesToSign()))).toBe(
      true
    );
    expect(Buffer.from(seen[1]!).equals(Buffer.from(first.bytesToSign()))).toBe(
      true
    );

    const decodedSecond = algosdk.decodeSignedTransaction(signed[0]!);
    const decodedFirst = algosdk.decodeSignedTransaction(signed[1]!);
    expect(decodedSecond.txn.txID()).toBe(second.txID());
    expect(decodedFirst.txn.txID()).toBe(first.txID());
    expect(
      nacl.sign.detached.verify(
        second.bytesToSign(),
        decodedSecond.sig!,
        key.publicKey
      )
    ).toBe(true);
  });

  it("rejects a signature made over the transaction without its group", async () => {
    const key = nacl.sign.keyPair();
    const address = algosdk.encodeAddress(key.publicKey);
    const [grouped] = groupedPayments(address);
    const alone = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: address,
      receiver: address,
      amount: 1,
      suggestedParams,
    });

    await expect(
      signAlgorandGroupWithEd25519({
        signerAddress: address,
        txnGroup: [grouped],
        indexesToSign: [0],
        signBytes: async () => nacl.sign.detached(alone.bytesToSign(), key.secretKey),
      })
    ).rejects.toThrow(/does not match this Algorand account/);
  });
});

describe("signatureHexToBytes", () => {
  it("decodes a 64-byte hex signature", () => {
    const raw = new Uint8Array(64).fill(7);
    raw[0] = 0xab;
    expect(Buffer.from(signatureHexToBytes(bytesToHex(raw))).equals(raw)).toBe(
      true
    );
    expect(
      Buffer.from(signatureHexToBytes(`0x${bytesToHex(raw)}`)).equals(raw)
    ).toBe(true);
  });

  it("rejects a signature that is not 64 bytes", () => {
    expect(() => signatureHexToBytes("abcd")).toThrow(/unexpected signature/);
  });
});

describe("signatureToBytes", () => {
  it("decodes a 64-byte base58 signature", () => {
    const raw = new Uint8Array(64);
    expect(Buffer.from(signatureToBytes("1".repeat(64))).equals(raw)).toBe(true);
  });

  it("decodes a 64-byte hex signature", () => {
    const raw = new Uint8Array(64).fill(3);
    expect(Buffer.from(signatureToBytes(bytesToHex(raw))).equals(raw)).toBe(true);
  });
});
