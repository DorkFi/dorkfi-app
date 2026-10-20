import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPortfolioChainRefresh,
  mergeChainPositionIntoApiSnapshot,
  readPortfolioChainRefresh,
  rememberPortfolioChainRefresh,
} from "../portfolioChainRefresh";

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
      {
        network: "voi-mainnet",
        poolId: "47139778",
        appId: "47139778",
        marketId: "420069",
        underlyingContractId: "420069",
        scaledDeposits: "5000",
        scaledBorrows: "0",
        depositIndex: "1000000000000000000",
        borrowIndex: "0",
      },
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

describe("rememberPortfolioChainRefresh", () => {
  const store = new Map<string, string>();

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it("round-trips a hint for the same address and drops an expired one", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });

    rememberPortfolioChainRefresh({
      address: "ADDR",
      network: "voi-mainnet",
      poolId: "10",
      marketId: "20",
      until: Date.now() + 30_000,
    });
    expect(readPortfolioChainRefresh("ADDR")?.marketId).toBe("20");
    expect(readPortfolioChainRefresh("OTHER")).toBeNull();

    clearPortfolioChainRefresh();
    expect(readPortfolioChainRefresh("ADDR")).toBeNull();
  });
});
