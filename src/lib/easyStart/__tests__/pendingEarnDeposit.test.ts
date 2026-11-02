import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_EARN_DEPOSIT_KEY,
  clearPendingEarnDeposit,
  isPendingEarnFunded,
  patchPendingEarnDeposit,
  pendingEarnBlocksNewSwap,
  pendingEarnSupplyAmount,
  readPendingEarnDeposit,
  savePendingEarnDeposit,
} from "@/lib/easyStart/pendingEarnDeposit";

const job = {
  algorandAddress: "I7CRHZD5UI7FOSRFD7ATCNC3JKS2ZZNFWF6CY664MFEZLQXS7JEP3KG4VM",
  wantedAmount: 60,
  fromBaseAmount: 30.95,
  expectedToAmount: 30.28,
  algoUsdcBefore: 29.05,
  at: Date.now(),
};

describe("pendingEarnDeposit storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves, reads for the same address, and ignores another wallet", () => {
    savePendingEarnDeposit(job);
    expect(store.get(PENDING_EARN_DEPOSIT_KEY)).toBeTruthy();
    expect(readPendingEarnDeposit(job.algorandAddress)?.wantedAmount).toBe(60);
    expect(readPendingEarnDeposit("OTHERADDRESS")).toBeNull();
  });

  it("patches the Exodus ids and clears after supply", () => {
    savePendingEarnDeposit(job);
    patchPendingEarnDeposit({ orderId: "ord_1", fromTxId: "0xabc" });
    expect(readPendingEarnDeposit(job.algorandAddress)?.fromTxId).toBe("0xabc");
    clearPendingEarnDeposit();
    expect(readPendingEarnDeposit(job.algorandAddress)).toBeNull();
  });
});

describe("pendingEarnDeposit amounts", () => {
  it("is funded after the Exodus credit and supplies min(wanted, wallet)", () => {
    expect(isPendingEarnFunded(job, 59.34)).toBe(true);
    expect(pendingEarnSupplyAmount(job, 59.34)).toBeCloseTo(59.34);
    expect(pendingEarnSupplyAmount(job, 80)).toBe(60);
  });

  it("blocks a second swap for the same Earn request", () => {
    expect(pendingEarnBlocksNewSwap({ ...job, fromTxId: "0xabc" }, 60)).toBe(
      true
    );
    expect(pendingEarnBlocksNewSwap(job, 60)).toBe(false);
    expect(pendingEarnBlocksNewSwap({ ...job, fromTxId: "0xabc" }, 120)).toBe(
      false
    );
  });
});
