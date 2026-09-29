import { afterEach, describe, expect, it } from "vitest";
import {
  deletePendingEarnDepositJob,
  getPendingEarnDepositJob,
  parsePendingEarnDepositJob,
  resetPendingEarnDepositStoreForTests,
  setPendingEarnDepositJob,
} from "../pendingDepositStore";

const job = {
  algorandAddress: "I7CRHZD5UI7FOSRFD7ATCNC3JKS2ZZNFWF6CY664MFEZLQXS7JEP3KG4VM",
  wantedAmount: 60,
  fromBaseAmount: 30.95,
  expectedToAmount: 30.28,
  algoUsdcBefore: 29.05,
  orderId: "ord_1",
  at: Date.now(),
};

afterEach(() => {
  resetPendingEarnDepositStoreForTests();
});

describe("pendingDepositStore", () => {
  it("rejects a 1:1-looking payload that is missing required amounts", () => {
    expect(
      parsePendingEarnDepositJob({
        algorandAddress: job.algorandAddress,
        wantedAmount: 60,
      })
    ).toBeNull();
  });

  it("saves, reads, and deletes by Privy user id", () => {
    expect(setPendingEarnDepositJob("did:privy:1", job)?.expectedToAmount).toBe(
      30.28
    );
    expect(getPendingEarnDepositJob("did:privy:1")?.orderId).toBe("ord_1");
    expect(getPendingEarnDepositJob("did:privy:2")).toBeNull();
    deletePendingEarnDepositJob("did:privy:1");
    expect(getPendingEarnDepositJob("did:privy:1")).toBeNull();
  });

  it("drops a job older than 7 days", () => {
    expect(
      parsePendingEarnDepositJob({
        ...job,
        at: Date.now() - 8 * 24 * 60 * 60 * 1000,
      })
    ).toBeNull();
  });
});
