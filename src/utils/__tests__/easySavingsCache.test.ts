import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  applyOptimisticSavingsPosition,
  easySavingsDepositQueryKey,
  easySavingsWalletQueryKey,
  invalidateEasySavingsAfterTx,
} from "@/utils/easySavingsCache";
import {
  __resetRpcReadCacheForTests,
  getRpcReadCache,
  setRpcReadCache,
} from "@/utils/rpcReadCache";
import { walletArc200RpcCacheKey } from "@/utils/walletBalanceRpc";

describe("applyOptimisticSavingsPosition", () => {
  it("adds a deposit onto a zero cached position and reduces wallet", () => {
    const queryClient = new QueryClient();
    const depositKey = easySavingsDepositQueryKey(
      "algorand-mainnet",
      "ADDR",
      "pool",
      "mkt"
    );
    const walletKey = easySavingsWalletQueryKey(
      "algorand-mainnet",
      "ADDR",
      "USDC"
    );
    queryClient.setQueryData(depositKey, { balance: 0, interest: 0.01 });
    queryClient.setQueryData(walletKey, 40);

    const { nextBalance } = applyOptimisticSavingsPosition({
      queryClient,
      networkId: "algorand-mainnet",
      address: "ADDR",
      poolId: "pool",
      contractId: "mkt",
      configKey: "USDC",
      delta: 25,
    });

    expect(nextBalance).toBe(25);
    expect(queryClient.getQueryData(depositKey)).toEqual({
      balance: 25,
      interest: 0.01,
    });
    expect(queryClient.getQueryData(walletKey)).toBe(15);
  });

  it("subtracts a withdraw and floors at zero", () => {
    const queryClient = new QueryClient();
    const depositKey = easySavingsDepositQueryKey(
      "algorand-mainnet",
      "ADDR",
      "pool",
      "mkt"
    );
    queryClient.setQueryData(depositKey, { balance: 10, interest: 0 });

    const { nextBalance } = applyOptimisticSavingsPosition({
      queryClient,
      networkId: "algorand-mainnet",
      address: "ADDR",
      poolId: "pool",
      contractId: "mkt",
      delta: -12,
    });

    expect(nextBalance).toBe(0);
    expect(queryClient.getQueryData(depositKey)).toEqual({
      balance: 0,
      interest: 0,
    });
  });
});

describe("invalidateEasySavingsAfterTx", () => {
  it("clears userDeposit and ARC200 RPC keys so the refetch is live", () => {
    __resetRpcReadCacheForTests();
    setRpcReadCache("userDeposit:algorand-mainnet:ADDR:pool:mkt", {
      balance: 0,
      interest: 0,
    });
    setRpcReadCache(walletArc200RpcCacheKey("ADDR", "ntoken"), "0");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    invalidateEasySavingsAfterTx({
      queryClient,
      networkId: "algorand-mainnet",
      address: "ADDR",
    });

    expect(
      getRpcReadCache("userDeposit:algorand-mainnet:ADDR:pool:mkt")
    ).toBeUndefined();
    expect(getRpcReadCache(walletArc200RpcCacheKey("ADDR", "ntoken"))).toBeUndefined();
    __resetRpcReadCacheForTests();
  });
});
