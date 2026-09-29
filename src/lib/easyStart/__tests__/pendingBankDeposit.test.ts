import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BANK_DEPOSIT_MAX_AGE_MS,
  BANK_DEPOSIT_MIN_GAIN_USDC,
  PENDING_BANK_DEPOSIT_KEY,
  bankDepositBaseline,
  bankDepositHasArrived,
  clearPendingBankDeposit,
  readPendingBankDeposit,
  savePendingBankDeposit,
  shouldPromptBankDepositArrival,
} from "@/lib/easyStart/pendingBankDeposit";

const ADDRESS = "0x1111111111111111111111111111111111111111";

describe("pendingBankDeposit storage", () => {
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

  it("round-trips the checkout that has to survive a closed sheet", () => {
    const job = savePendingBankDeposit({
      address: ADDRESS,
      amount: "100",
      usdcBefore: 2.5,
      partnerUserRef: "df-user-1",
    });
    expect(readPendingBankDeposit(ADDRESS)).toMatchObject({
      address: ADDRESS,
      amount: "100",
      usdcBefore: 2.5,
      partnerUserRef: "df-user-1",
      method: "coinbase",
      at: job.at,
    });
    expect(readPendingBankDeposit("0x2222222222222222222222222222222222222222")).toBeNull();
    clearPendingBankDeposit();
    expect(store.has(PENDING_BANK_DEPOSIT_KEY)).toBe(false);
  });

  it("drops a job older than a slow ACH window", () => {
    savePendingBankDeposit({
      address: ADDRESS,
      amount: "100",
      usdcBefore: 0,
      partnerUserRef: "df-user-1",
      at: Date.now() - BANK_DEPOSIT_MAX_AGE_MS - 1,
    });
    expect(readPendingBankDeposit(ADDRESS)).toBeNull();
    expect(store.has(PENDING_BANK_DEPOSIT_KEY)).toBe(false);
  });
});

describe("bank deposit arrival", () => {
  const job = {
    address: ADDRESS,
    amount: "100",
    usdcBefore: 10,
    partnerUserRef: "df-user-1",
    method: "coinbase" as const,
    at: 1,
  };

  it("keeps the original baseline when checkout is reopened", () => {
    expect(bankDepositBaseline({ existing: job, currentUsdc: 40 })).toBe(10);
    expect(bankDepositBaseline({ existing: null, currentUsdc: 4 })).toBe(4);
    expect(bankDepositBaseline({ existing: null, currentUsdc: Number.NaN })).toBe(0);
  });

  it("treats a 0.5 USDC credit as arrived and ignores noise below that", () => {
    expect(bankDepositHasArrived(job, 10 + BANK_DEPOSIT_MIN_GAIN_USDC)).toBe(true);
    expect(bankDepositHasArrived(job, 10.49)).toBe(false);
    expect(bankDepositHasArrived(job, Number.NaN)).toBe(false);
  });

  it("prompts only when the sheet is closed and this job has not already opened", () => {
    expect(
      shouldPromptBankDepositArrival({
        job,
        sheetOpen: true,
        currentUsdc: 110,
        alreadyPromptedAt: null,
      })
    ).toBe(false);
    expect(
      shouldPromptBankDepositArrival({
        job,
        sheetOpen: false,
        currentUsdc: 110,
        alreadyPromptedAt: null,
      })
    ).toBe(true);
    expect(
      shouldPromptBankDepositArrival({
        job,
        sheetOpen: false,
        currentUsdc: 110,
        alreadyPromptedAt: job.at,
      })
    ).toBe(false);
    expect(
      shouldPromptBankDepositArrival({
        job: null,
        sheetOpen: false,
        currentUsdc: 110,
        alreadyPromptedAt: null,
      })
    ).toBe(false);
  });
});
