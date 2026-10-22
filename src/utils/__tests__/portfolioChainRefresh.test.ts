import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyChainReadsToSnapshot,
  clearPortfolioChainRefresh,
  commitPortfolioChainRefreshHints,
  mergeChainPositionIntoApiSnapshot,
  overlayPendingPortfolioPositions,
  readPortfolioChainRefresh,
  rememberPortfolioChainRefresh,
  type PortfolioChainRefreshHint,
} from "../portfolioChainRefresh";

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  return store;
}

const chainDeposit = {
  network: "voi-mainnet",
  poolId: "47139778",
  appId: "47139778",
  marketId: "420069",
  underlyingContractId: "420069",
  scaledDeposits: "5000",
  scaledBorrows: "0",
  depositIndex: "1000000000000000000",
  borrowIndex: "0",
};

describe("mergeChainPositionIntoApiSnapshot", () => {
  it("replaces a stored zero row so a new deposit is visible", () => {
    const apiRow = {
      network: "voi-mainnet",
      appId: 47139778,
      marketId: 420069,
      scaledDeposits: "0",
      scaledBorrows: "0",
      depositIndex: "0",
      borrowIndex: "0",
      lastPrice: "1",
    };
    const merged = mergeChainPositionIntoApiSnapshot(
      [apiRow],
      [
        {
          network: "voi-mainnet",
          appId: 47139778,
          totalCollateralValue: "0",
          totalBorrowValue: "0",
        },
      ],
      chainDeposit,
      {
        network: "voi-mainnet",
        poolId: "47139778",
        totalCollateralValue: "2500000000000",
        totalBorrowValue: "0",
      }
    );

    expect(merged.userData).toHaveLength(1);
    expect(merged.userData[0].scaledDeposits).toBe("5000");
    expect(merged.userData[0].lastPrice).toBe("1");
    expect(merged.globalUserData).toHaveLength(1);
    expect(merged.globalUserData[0].totalCollateralValue).toBe("2500000000000");
  });

  it("replaces a stale deposit with a smaller withdraw balance", () => {
    const merged = mergeChainPositionIntoApiSnapshot(
      [
        {
          network: "voi-mainnet",
          appId: "47139778",
          marketId: "420069",
          scaledDeposits: "5000",
          scaledBorrows: "0",
        },
      ],
      [],
      { ...chainDeposit, scaledDeposits: "1200" },
      null
    );
    expect(merged.userData[0].scaledDeposits).toBe("1200");
  });

  it("writes a zero chain balance over a withdrawn position", () => {
    const merged = mergeChainPositionIntoApiSnapshot(
      [
        {
          network: "voi-mainnet",
          appId: "47139778",
          marketId: "420069",
          scaledDeposits: "5000",
          scaledBorrows: "80",
        },
      ],
      [],
      { ...chainDeposit, scaledDeposits: "0", scaledBorrows: "0" },
      null
    );
    expect(merged.userData).toHaveLength(1);
    expect(merged.userData[0].scaledDeposits).toBe("0");
    expect(merged.userData[0].scaledBorrows).toBe("0");
  });

  it("appends a market and pool the snapshot has never stored", () => {
    const merged = mergeChainPositionIntoApiSnapshot(
      [],
      [],
      {
        network: "algorand-mainnet",
        poolId: "3333688282",
        appId: "3333688282",
        marketId: "0",
        underlyingContractId: "0",
        scaledDeposits: "10",
        scaledBorrows: "0",
        depositIndex: "1",
        borrowIndex: "0",
      },
      {
        network: "algorand-mainnet",
        poolId: "3333688282",
        totalCollateralValue: "99",
        totalBorrowValue: "0",
      }
    );
    expect(merged.userData).toHaveLength(1);
    expect(merged.globalUserData).toHaveLength(1);
  });

  it("leaves the snapshot alone when the chain read failed", () => {
    const userData = [{ network: "voi-mainnet", appId: "1", marketId: "2", scaledDeposits: "7" }];
    const globalUserData = [{ network: "voi-mainnet", appId: "1", totalCollateralValue: "3" }];
    const merged = mergeChainPositionIntoApiSnapshot(
      userData,
      globalUserData,
      null,
      null
    );
    expect(merged.userData).toEqual(userData);
    expect(merged.globalUserData).toEqual(globalUserData);
  });
});

describe("applyChainReadsToSnapshot", () => {
  const hint: PortfolioChainRefreshHint = {
    address: "ADDR",
    network: "voi-mainnet",
    poolId: "47139778",
    marketId: "420069",
  };

  it("builds a snapshot from one chain row when the API has no user", () => {
    const applied = applyChainReadsToSnapshot(
      [],
      [],
      [
        {
          hint,
          userRow: chainDeposit,
          globalRow: {
            network: "voi-mainnet",
            poolId: "47139778",
            totalCollateralValue: "2500000000000",
            totalBorrowValue: "0",
          },
        },
      ],
      [
        {
          network: "voi-mainnet",
          poolId: "47139778",
          totalCollateralValue: "2500000000000",
          totalBorrowValue: "0",
        },
        {
          network: "algorand-mainnet",
          poolId: "99",
          totalCollateralValue: "10",
          totalBorrowValue: "4",
        },
      ]
    );

    expect(applied.painted).toBe(true);
    expect(applied.userData[0].scaledDeposits).toBe("5000");
    expect(applied.globalUserData).toHaveLength(2);
    expect(applied.hintsToKeep).toHaveLength(1);
    expect(applied.hintsToKeep[0].scaledDeposits).toBe("5000");
  });

  it("drops the pending market once the API row matches the chain", () => {
    const applied = applyChainReadsToSnapshot(
      [
        {
          network: "voi-mainnet",
          appId: "47139778",
          marketId: "420069",
          scaledDeposits: "5000",
          scaledBorrows: "0",
        },
      ],
      [],
      [{ hint, userRow: chainDeposit, globalRow: null }],
      null
    );
    expect(applied.hintsToKeep).toHaveLength(0);
    expect(applied.userData[0].scaledDeposits).toBe("5000");
  });

  it("keeps a withdraw overlay when the API still has the old balance", () => {
    const applied = applyChainReadsToSnapshot(
      [
        {
          network: "voi-mainnet",
          appId: "47139778",
          marketId: "420069",
          scaledDeposits: "5000",
          scaledBorrows: "0",
        },
      ],
      [],
      [
        {
          hint,
          userRow: { ...chainDeposit, scaledDeposits: "0" },
          globalRow: null,
        },
      ],
      null
    );
    expect(applied.userData[0].scaledDeposits).toBe("0");
    expect(applied.hintsToKeep[0].scaledDeposits).toBe("0");
  });

  it("uses the last stored amounts when the chain read fails", () => {
    const applied = applyChainReadsToSnapshot(
      [
        {
          network: "voi-mainnet",
          appId: "47139778",
          marketId: "420069",
          scaledDeposits: "5000",
          scaledBorrows: "0",
        },
      ],
      [],
      [
        {
          hint: { ...hint, scaledDeposits: "1200", scaledBorrows: "0" },
          userRow: null,
          globalRow: null,
        },
      ],
      null
    );
    expect(applied.painted).toBe(true);
    expect(applied.userData[0].scaledDeposits).toBe("1200");
    expect(applied.hintsToKeep).toHaveLength(1);
  });
});

describe("rememberPortfolioChainRefresh", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps every pending market for an address", () => {
    stubLocalStorage();

    rememberPortfolioChainRefresh({
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "10",
      marketId: "20",
    });
    rememberPortfolioChainRefresh({
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "10",
      marketId: "21",
      scaledDeposits: "5",
      scaledBorrows: "0",
    });
    rememberPortfolioChainRefresh({
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "10",
      marketId: "21",
    });

    const rows = readPortfolioChainRefresh("ADDR");
    expect(rows.map((row) => row.marketId)).toEqual(["20", "21"]);
    expect(rows[1].scaledDeposits).toBe("5");
    expect(readPortfolioChainRefresh("OTHER")).toEqual([]);

    clearPortfolioChainRefresh("ADDR");
    expect(readPortfolioChainRefresh("ADDR")).toEqual([]);
  });

  it("drops resolved markets and keeps one saved during the read", () => {
    stubLocalStorage();
    const first: PortfolioChainRefreshHint = {
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "10",
      marketId: "20",
    };
    const second: PortfolioChainRefreshHint = {
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "10",
      marketId: "21",
    };
    rememberPortfolioChainRefresh(first);
    rememberPortfolioChainRefresh(second);
    rememberPortfolioChainRefresh({
      address: "OTHER",
      network: "voi-mainnet",
      poolId: "1",
      marketId: "2",
    });

    rememberPortfolioChainRefresh({
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "10",
      marketId: "22",
    });
    commitPortfolioChainRefreshHints("ADDR", [first, second], [
      { ...second, scaledDeposits: "9", scaledBorrows: "0" },
    ]);

    const rows = readPortfolioChainRefresh("ADDR");
    expect(rows.map((row) => row.marketId)).toEqual(["21", "22"]);
    expect(rows[0].scaledDeposits).toBe("9");
    expect(readPortfolioChainRefresh("OTHER")).toHaveLength(1);
  });
});

describe("overlayPendingPortfolioPositions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a failed read and then paints the chain row onto an empty snapshot", async () => {
    stubLocalStorage();
    rememberPortfolioChainRefresh({
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "47139778",
      marketId: "420069",
    });

    let calls = 0;
    const result = await overlayPendingPortfolioPositions({
      userAddress: "ADDR",
      apiUserData: [],
      apiGlobalUserData: [],
      attempts: 3,
      retryDelayMs: 0,
      readMarket: async () => {
        calls += 1;
        if (calls < 3) return { userRow: null, globalRow: null };
        return {
          userRow: chainDeposit,
          globalRow: {
            network: "voi-mainnet",
            poolId: "47139778",
            totalCollateralValue: "11",
            totalBorrowValue: "0",
          },
        };
      },
      readPoolGlobals: async () => [
        {
          network: "voi-mainnet",
          poolId: "47139778",
          totalCollateralValue: "11",
          totalBorrowValue: "0",
        },
      ],
    });

    expect(calls).toBe(3);
    expect(result.painted).toBe(true);
    expect(result.userData[0].scaledDeposits).toBe("5000");
    expect(result.globalUserData[0].totalCollateralValue).toBe("11");
    expect(readPortfolioChainRefresh("ADDR")[0].scaledDeposits).toBe("5000");
  });

  it("keeps the last amounts when every chain read fails", async () => {
    stubLocalStorage();
    rememberPortfolioChainRefresh({
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "47139778",
      marketId: "420069",
      scaledDeposits: "5000",
      scaledBorrows: "0",
    });

    const result = await overlayPendingPortfolioPositions({
      userAddress: "ADDR",
      apiUserData: [
        {
          network: "voi-mainnet",
          appId: "47139778",
          marketId: "420069",
          scaledDeposits: "0",
          scaledBorrows: "0",
        },
      ],
      apiGlobalUserData: [],
      attempts: 2,
      retryDelayMs: 0,
      readMarket: async () => {
        throw new Error("algod down");
      },
      readPoolGlobals: async () => [],
    });

    expect(result.painted).toBe(true);
    expect(result.userData[0].scaledDeposits).toBe("5000");
    expect(readPortfolioChainRefresh("ADDR")).toHaveLength(1);
  });

  it("does not clear pending markets when the fetch is no longer current", async () => {
    stubLocalStorage();
    rememberPortfolioChainRefresh({
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "47139778",
      marketId: "420069",
    });

    const result = await overlayPendingPortfolioPositions({
      userAddress: "ADDR",
      apiUserData: [],
      apiGlobalUserData: [],
      isCurrent: () => false,
      attempts: 1,
      retryDelayMs: 0,
      readMarket: async () => ({ userRow: chainDeposit, globalRow: null }),
      readPoolGlobals: async () => [],
    });

    expect(result.painted).toBe(false);
    expect(readPortfolioChainRefresh("ADDR")).toHaveLength(1);
  });
});
