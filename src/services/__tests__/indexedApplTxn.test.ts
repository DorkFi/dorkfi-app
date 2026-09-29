import { describe, expect, it } from "vitest";
import {
  classifyLendingNote,
  describeIndexedLendingCall,
  formatAtomicAmount,
  readIndexedApplTxn,
} from "@/services/indexedApplTxn";

describe("readIndexedApplTxn", () => {
  it("reads an algosdk 3 decoded application call", () => {
    expect(
      readIndexedApplTxn({
        id: "TXID123",
        roundTime: 1_700_000_000,
        applicationTransaction: { applicationId: 123456n },
      })
    ).toEqual({
      txId: "TXID123",
      applicationId: 123456,
      roundTimeSec: 1_700_000_000,
    });
  });

  it("still reads raw indexer JSON", () => {
    expect(
      readIndexedApplTxn({
        id: "TXID456",
        "round-time": 1_700_000_100,
        "application-transaction": { "application-id": 99 },
      })
    ).toEqual({
      txId: "TXID456",
      applicationId: 99,
      roundTimeSec: 1_700_000_100,
    });
  });

  it("drops a hit with no application id", () => {
    expect(readIndexedApplTxn({ id: "TXID789", roundTime: 10 })).toBeNull();
  });
});

describe("classifyLendingNote", () => {
  it("reads a deposit note", () => {
    expect(classifyLendingNote("lending deposit 100.000000 USDC")).toEqual({
      kind: "deposit",
      amount: "100",
      symbol: "USDC",
    });
  });

  it("prefers the underlying amount on a withdraw note", () => {
    expect(
      classifyLendingNote(
        "lending withdraw 99.930000 nUSDC (underlying: 99.927100 USDC)"
      )
    ).toEqual({
      kind: "withdraw",
      amount: "99.9271",
      symbol: "USDC",
    });
  });

  it("reads a bare lending action", () => {
    expect(classifyLendingNote("lending borrow")).toEqual({ kind: "borrow" });
  });

  it("reads the arccjs note that is actually stored on chain", () => {
    expect(
      classifyLendingNote(
        "arccjs-v2.10.6:u custom lending deposit 13.021569 USDC"
      )
    ).toEqual({
      kind: "deposit",
      amount: "13.021569",
      symbol: "USDC",
    });
    expect(
      classifyLendingNote(
        "arccjs-v2.10.6:u custom lending withdraw 9.000000 nUSDC (underlying: 9.000000 USDC)"
      )
    ).toEqual({
      kind: "withdraw",
      amount: "9",
      symbol: "USDC",
    });
    expect(
      classifyLendingNote("arccjs-v2.10.6:u custom lending borrow")
    ).toEqual({ kind: "borrow" });
    expect(
      classifyLendingNote("arccjs-v2.10.6:u custom lending repay")
    ).toEqual({ kind: "repay" });
  });
});

function encodeUint(value: bigint, width: number): Uint8Array {
  const out = new Uint8Array(width);
  let remaining = value;
  for (let i = width - 1; i >= 0; i--) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return out;
}

describe("formatAtomicAmount", () => {
  it("scales a 6-decimal token and trims zeros", () => {
    expect(formatAtomicAmount(10_000_000n, 6)).toBe("10");
    expect(formatAtomicAmount(13_021_569n, 6)).toBe("13.021569");
  });
});

describe("describeIndexedLendingCall", () => {
  it("labels a decoded pool call from its note", () => {
    const note = new TextEncoder().encode("lending deposit 30.500000 USDC");
    expect(
      describeIndexedLendingCall({
        id: "TXIDNOTE",
        roundTime: 1_700_000_000,
        applicationTransaction: { applicationId: 42 },
        note,
      })
    ).toMatchObject({
      txId: "TXIDNOTE",
      kind: "deposit",
      amount: "30.5",
      symbol: "USDC",
    });
  });

  it("reads a borrow amount from the uint256 argument", () => {
    const note = new TextEncoder().encode(
      "arccjs-v2.10.6:u custom lending borrow"
    );
    expect(
      describeIndexedLendingCall(
        {
          id: "TXIDBORROW",
          roundTime: 1_700_000_000,
          applicationTransaction: {
            applicationId: 42,
            applicationArgs: [
              new Uint8Array([1, 2, 3, 4]),
              encodeUint(3210682240n, 8),
              encodeUint(10_000_000n, 32),
            ],
          },
          note,
        },
        (marketId) =>
          marketId === 3210682240 ? { decimals: 6, symbol: "USDC" } : null
      )
    ).toMatchObject({
      kind: "borrow",
      amount: "10",
      symbol: "USDC",
    });
  });

  it("keeps a deposit note amount instead of the atomic argument", () => {
    const note = new TextEncoder().encode(
      "arccjs-v2.10.6:u custom lending deposit 55.000000 USDC"
    );
    expect(
      describeIndexedLendingCall(
        {
          id: "TXIDDEPOSIT",
          roundTime: 1_700_000_000,
          applicationTransaction: {
            applicationId: 42,
            applicationArgs: [
              new Uint8Array([1, 2, 3, 4]),
              encodeUint(3210682240n, 8),
              encodeUint(1n, 32),
            ],
          },
          note,
        },
        () => ({ decimals: 6, symbol: "USDC" })
      )
    ).toMatchObject({
      kind: "deposit",
      amount: "55",
      symbol: "USDC",
    });
  });
});
