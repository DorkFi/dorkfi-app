import { describe, expect, it } from "vitest";
import algosdk from "algosdk";
import {
  chunk,
  createSigningBatches,
  createSigningBatchesFromEncoded,
  groupTransactions,
} from "@/lib/algorand/grouping";
import { reconstructSignedGroups } from "@/lib/algorand/signing";

describe("chunk", () => {
  it("splits items into fixed-size chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("groupTransactions", () => {
  it("creates groups of at most 16 with shared group id", () => {
    const addr = algosdk.encodeAddress(new Uint8Array(32).fill(7));
    const suggestedParams = {
      fee: 1000,
      firstValid: 1,
      lastValid: 1000,
      genesisHash: new Uint8Array(32).fill(1),
      genesisID: "test",
      minFee: 1000,
    };
    const txns = Array.from({ length: 20 }, (_, i) =>
      algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: addr,
        receiver: addr,
        amount: i,
        suggestedParams,
      })
    );
    const groups = groupTransactions(txns);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(16);
    expect(groups[1]).toHaveLength(4);
    const g0 = groups[0]![0]!.group!;
    expect(groups[0]!.every((t) => Buffer.compare(t.group!, g0) === 0)).toBe(true);
  });
});

describe("createSigningBatches", () => {
  it("flattens up to 16 atomic groups per signing batch", () => {
    const groups = Array.from({ length: 20 }, () => [] as algosdk.Transaction[]);
    const batches = createSigningBatches(groups);
    expect(batches).toHaveLength(2);
    expect(batches[0]!.groups).toHaveLength(16);
    expect(batches[1]!.groups).toHaveLength(4);
  });
});

describe("createSigningBatchesFromEncoded", () => {
  it("preserves encoded bytes without re-encoding", () => {
    const encoded = [
      [new Uint8Array([1, 2])],
      [new Uint8Array([3]), new Uint8Array([4])],
    ];
    const batches = createSigningBatchesFromEncoded(encoded);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.flat).toHaveLength(3);
    expect(batches[0]!.flat[0]).toEqual(new Uint8Array([1, 2]));
  });
});

describe("reconstructSignedGroups", () => {
  it("splits flat signed bytes by group sizes", () => {
    const flat = [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])];
    const groups = reconstructSignedGroups(flat, [1, 2]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(1);
    expect(groups[1]).toHaveLength(2);
  });
});
