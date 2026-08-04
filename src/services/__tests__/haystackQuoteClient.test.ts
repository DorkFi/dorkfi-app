import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHaystackDeadlineSignal,
  fetchHaystackQuote,
  formatHaystackFetchError,
  HAYSTACK_QUOTE_TIMEOUT_MS,
} from "@/services/haystackRouterService";

describe("formatHaystackFetchError", () => {
  it("maps TimeoutError to a proxy-unavailable message", () => {
    const err = Object.assign(new Error("deadline"), { name: "TimeoutError" });
    expect(formatHaystackFetchError(err, "quote").message).toMatch(
      /timed out.*routing proxy/i
    );
  });

  it("maps network TypeError to a unreachable-proxy message", () => {
    const err = Object.assign(new Error("Failed to fetch"), {
      name: "TypeError",
    });
    expect(formatHaystackFetchError(err, "quote").message).toMatch(
      /could not reach the routing proxy/i
    );
  });

  it("rethrows AbortError unchanged for cancel handling", () => {
    const err = Object.assign(new Error("Aborted"), { name: "AbortError" });
    expect(formatHaystackFetchError(err, "quote")).toBe(err);
  });
});

describe("createHaystackDeadlineSignal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts with TimeoutError after the deadline", () => {
    vi.useFakeTimers();
    const { signal, cleanup } = createHaystackDeadlineSignal(1_000);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(signal.aborted).toBe(true);
    expect(signal.reason).toMatchObject({ name: "TimeoutError" });
    cleanup();
  });

  it("aborts immediately when the external signal is already aborted", () => {
    const external = new AbortController();
    external.abort();
    const { signal, cleanup } = createHaystackDeadlineSignal(5_000, external.signal);
    expect(signal.aborted).toBe(true);
    cleanup();
  });
});

describe("fetchHaystackQuote", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("times out hung fetches instead of waiting indefinitely", async () => {
    vi.stubEnv("VITE_HAYSTACK_PROXY_URL", "https://proxy.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) return;
            if (signal.aborted) {
              reject(
                Object.assign(new Error("Aborted"), { name: "AbortError" })
              );
              return;
            }
            signal.addEventListener(
              "abort",
              () => {
                reject(
                  signal.reason instanceof Error
                    ? signal.reason
                    : Object.assign(new Error("Aborted"), {
                        name: "TimeoutError",
                      })
                );
              },
              { once: true }
            );
          })
      )
    );

    await expect(
      fetchHaystackQuote({
        amount: 1_000_000,
        type: "fixed-output",
        fromASAID: 0,
        toASAID: 31566704,
        timeoutMs: 50,
      })
    ).rejects.toThrow(/timed out.*routing proxy/i);
  });

  it("returns a successful quote payload", async () => {
    vi.stubEnv("VITE_HAYSTACK_PROXY_URL", "https://proxy.test");
    const body = {
      quote: 42,
      txnPayload: { iv: "a", data: "b" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const q = await fetchHaystackQuote({
      amount: 1,
      type: "fixed-output",
      fromASAID: 0,
      toASAID: 1,
    });
    expect(q.quote).toBe(42);
    expect(q.txnPayload).toEqual({ iv: "a", data: "b" });
    expect(HAYSTACK_QUOTE_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
