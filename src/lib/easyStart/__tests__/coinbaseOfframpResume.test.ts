import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CB_OFFRAMP_PENDING_KEY,
  clearCoinbaseOfframpPending,
  consumeCoinbaseOfframpReturn,
  isCoinbaseOfframpReferrer,
  parseCoinbaseOfframpReturnSearch,
  patchCoinbaseOfframpPending,
  readCoinbaseOfframpPending,
  saveCoinbaseOfframpPending,
} from "@/lib/easyStart/coinbaseOfframpResume";

describe("parseCoinbaseOfframpReturnSearch", () => {
  it("reads the cash-out return flag and partnerUserRef", () => {
    expect(
      parseCoinbaseOfframpReturnSearch("?cb_offramp=1&ref=privy-user-1")
    ).toEqual({ partnerUserRef: "privy-user-1" });
  });

  it("ignores unrelated portfolio query strings", () => {
    expect(parseCoinbaseOfframpReturnSearch("?tab=activity")).toBeNull();
    expect(parseCoinbaseOfframpReturnSearch("?cb_offramp=1")).toBeNull();
  });
});

describe("isCoinbaseOfframpReferrer", () => {
  it("accepts Coinbase hosted checkout hosts", () => {
    expect(isCoinbaseOfframpReferrer("https://pay.coinbase.com/v3/sell/input")).toBe(
      true
    );
    expect(isCoinbaseOfframpReferrer("https://simplfi.xyz/portfolio")).toBe(
      false
    );
  });
});

describe("coinbase offramp pending storage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
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

  it("round-trips amount and send hash", () => {
    saveCoinbaseOfframpPending({
      partnerUserRef: "privy-user-1",
      amount: "50",
    });
    expect(readCoinbaseOfframpPending()?.amount).toBe("50");
    patchCoinbaseOfframpPending({ sendTxHash: "0xabc" });
    expect(readCoinbaseOfframpPending()?.sendTxHash).toBe("0xabc");
    clearCoinbaseOfframpPending();
    expect(store.has(CB_OFFRAMP_PENDING_KEY)).toBe(false);
  });

  it("resumes from the return query when session storage is empty", () => {
    const pending = consumeCoinbaseOfframpReturn({
      href: "https://beta.simplfi.xyz/portfolio?cb_offramp=1&ref=privy-user-1",
      replaceUrl: () => {},
    });
    expect(pending).toMatchObject({
      partnerUserRef: "privy-user-1",
      amount: null,
    });
  });

  it("resumes from the return URL and strips the query", () => {
    saveCoinbaseOfframpPending({
      partnerUserRef: "privy-user-1",
      amount: "75",
    });
    const replaced: string[] = [];
    const pending = consumeCoinbaseOfframpReturn({
      href: "https://beta.simplfi.xyz/portfolio?cb_offramp=1&ref=privy-user-1&status=success",
      replaceUrl: (next) => replaced.push(next),
    });
    expect(pending).toMatchObject({
      partnerUserRef: "privy-user-1",
      amount: "75",
    });
    expect(replaced).toEqual(["/portfolio?status=success"]);
  });

  it("resumes from a Coinbase referrer when query params were stripped", () => {
    saveCoinbaseOfframpPending({
      partnerUserRef: "privy-user-1",
      amount: "20",
    });
    const pending = consumeCoinbaseOfframpReturn({
      href: "https://beta.simplfi.xyz/portfolio",
      referrer: "https://pay.coinbase.com/v3/sell",
    });
    expect(pending).toMatchObject({
      partnerUserRef: "privy-user-1",
      amount: "20",
    });
  });

  it("prefers stored partnerUserRef when Coinbase adds its own ref", () => {
    saveCoinbaseOfframpPending({
      partnerUserRef: "privy-user-1",
      amount: "40",
    });
    const pending = consumeCoinbaseOfframpReturn({
      href: "https://beta.simplfi.xyz/portfolio?cb_offramp=1&ref=other",
      replaceUrl: () => {},
    });
    expect(pending).toMatchObject({
      partnerUserRef: "privy-user-1",
      amount: "40",
    });
  });

  it("does not reopen cash-out from leftover storage alone", () => {
    saveCoinbaseOfframpPending({
      partnerUserRef: "privy-user-1",
      amount: "20",
    });
    expect(
      consumeCoinbaseOfframpReturn({
        href: "https://beta.simplfi.xyz/portfolio",
        referrer: "",
      })
    ).toBeNull();
  });
});
