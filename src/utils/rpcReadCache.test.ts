import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetRpcReadCacheForTests,
  getRpcReadCache,
  invalidateUserPositionRpcCache,
  setRpcReadCache,
  withRpcReadCache,
} from "./rpcReadCache";

describe("withRpcReadCache", () => {
  afterEach(() => {
    __resetRpcReadCacheForTests();
  });

  it("caches successful values including zero", async () => {
    const fetcher = vi.fn().mockResolvedValue(0);
    await expect(withRpcReadCache("userDeposit:t", fetcher)).resolves.toBe(0);
    await expect(withRpcReadCache("userDeposit:t", fetcher)).resolves.toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not cache null failures so retries re-fetch", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ balance: 1, interest: 0 });
    await expect(withRpcReadCache("userBorrow:t", fetcher)).resolves.toBeNull();
    expect(getRpcReadCache("userBorrow:t")).toBeUndefined();
    await expect(withRpcReadCache("userBorrow:t", fetcher)).resolves.toEqual({
      balance: 1,
      interest: 0,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent in-flight requests", async () => {
    let resolve!: (v: number) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<number>((r) => {
          resolve = r;
        })
    );
    const a = withRpcReadCache("inflight:t", fetcher);
    const b = withRpcReadCache("inflight:t", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(42);
    await expect(Promise.all([a, b])).resolves.toEqual([42, 42]);
  });
});

describe("invalidateUserPositionRpcCache", () => {
  afterEach(() => {
    __resetRpcReadCacheForTests();
  });

  it("clears deposit, borrow, and global-user keys for the user", () => {
    setRpcReadCache("userDeposit:net:addr:pool:mkt", 5);
    setRpcReadCache("userBorrow:net:addr:pool:mkt", { balance: 1, interest: 0 });
    setRpcReadCache("userGlobal:net:addr", { totalCollateralValue: 1 });
    setRpcReadCache("userGlobalPool:net:pool:addr", { totalBorrowValue: 1 });
    setRpcReadCache("userDeposit:net:other:pool:mkt", 9);

    invalidateUserPositionRpcCache("net", "addr");

    expect(getRpcReadCache("userDeposit:net:addr:pool:mkt")).toBeUndefined();
    expect(getRpcReadCache("userBorrow:net:addr:pool:mkt")).toBeUndefined();
    expect(getRpcReadCache("userGlobal:net:addr")).toBeUndefined();
    expect(getRpcReadCache("userGlobalPool:net:pool:addr")).toBeUndefined();
    expect(getRpcReadCache("userDeposit:net:other:pool:mkt")).toBe(9);
  });
});
