import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_EARN_WITHDRAW_KEY,
  clearPendingEarnWithdraw,
  isPendingEarnWithdrawComplete,
  patchPendingEarnWithdraw,
  pendingWithdrawBlocksNewSwap,
  readPendingEarnWithdraw,
  savePendingEarnWithdraw,
} from "@/lib/easyStart/pendingEarnWithdraw";

const job = {
  algorandAddress: "I7CRHZD5UI7FOSRFD7ATCNC3JKS2ZZNFWF6CY664MFEZLQXS7JEP3KG4VM",
  evmAddress: "0x1111111111111111111111111111111111111111",
  amount: 40,
  algoUsdcBefore: 40.5,
  baseUsdcBefore: 2,
  expectedToAmount: 39.4,
  at: Date.now(),
};

describe("pendingEarnWithdraw storage", () => {
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
    savePendingEarnWithdraw(job);
    expect(store.get(PENDING_EARN_WITHDRAW_KEY)).toBeTruthy();
    expect(readPendingEarnWithdraw(job.algorandAddress)?.amount).toBe(40);
    expect(readPendingEarnWithdraw("OTHERADDRESS")).toBeNull();
    expect(readPendingEarnWithdraw(job.algorandAddress)?.baseUsdcBefore).toBe(
      2
    );
  });

  it("patches the Exodus ids and keeps the job until Base credit", () => {
    savePendingEarnWithdraw(job);
    patchPendingEarnWithdraw({ orderId: "ord_1", fromTxId: "ALGOTX" });
    expect(readPendingEarnWithdraw(job.algorandAddress)?.fromTxId).toBe(
      "ALGOTX"
    );
    expect(readPendingEarnWithdraw(job.algorandAddress)?.amount).toBe(40);
    clearPendingEarnWithdraw();
    expect(readPendingEarnWithdraw(job.algorandAddress)).toBeNull();
  });

  it("drops a job older than 7 days", () => {
    savePendingEarnWithdraw({
      ...job,
      at: Date.now() - 8 * 24 * 60 * 60 * 1000,
    });
    expect(readPendingEarnWithdraw(job.algorandAddress)).toBeNull();
    expect(store.has(PENDING_EARN_WITHDRAW_KEY)).toBe(false);
  });
});

describe("pendingEarnWithdraw completion", () => {
  it("is complete only after Base USDC rises by most of the quote", () => {
    expect(isPendingEarnWithdrawComplete(job, 41.5)).toBe(true);
    expect(isPendingEarnWithdrawComplete(job, 2.01)).toBe(false);
    expect(
      isPendingEarnWithdrawComplete(
        { ...job, baseUsdcBefore: undefined },
        80
      )
    ).toBe(false);
  });

  it("blocks a second swap once Exodus has an order, and allows retry before send", () => {
    expect(
      pendingWithdrawBlocksNewSwap({ ...job, fromTxId: "ALGOTX" }, 40)
    ).toBe(true);
    expect(pendingWithdrawBlocksNewSwap(job, 40)).toBe(false);
    expect(
      pendingWithdrawBlocksNewSwap({ ...job, orderId: "ord_1" }, 90)
    ).toBe(false);
  });
});
