import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readPortfolioMarketsSessionCache,
  writePortfolioMarketsSessionCache,
  mergePortfolioMarketRows,
} from "../portfolioMarketHydrate";
import type { MarketInfo } from "@/services/lendingService";

const sample = {
  networkId: "algorand-mainnet",
  poolId: "1",
  marketId: "2",
  symbol: "UNIT",
  decimals: 8,
  price: "100",
} as MarketInfo;

describe("portfolioMarketsSessionCache", () => {
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

  it("round-trips MarketInfo rows", () => {
    writePortfolioMarketsSessionCache("algorand-mainnet", [sample]);
    const read = readPortfolioMarketsSessionCache("algorand-mainnet");
    expect(read).toHaveLength(1);
    expect(read?.[0]?.marketId).toBe("2");
    expect(read?.[0]?.symbol).toBe("UNIT");
  });

  it("returns null when empty", () => {
    expect(readPortfolioMarketsSessionCache("voi-mainnet")).toBeNull();
  });
});

describe("mergePortfolioMarketRows", () => {
  const baseKey = {
    networkId: "algorand-mainnet",
    poolId: "10",
    marketId: "20",
    symbol: "BTC",
    decimals: 8,
  } as const;

  it("keeps oracle-refined row when Phase A bulk has USD but no oracle", () => {
    const phaseB = {
      ...baseKey,
      price: "1000000",
      oracleUsdPerToken: 95_000,
    } as MarketInfo;
    const phaseA = {
      ...baseKey,
      price: "800000",
      // no oracleUsdPerToken — bulk decode only
    } as MarketInfo;

    const merged = mergePortfolioMarketRows([phaseB], [phaseA]) as MarketInfo[];
    expect(merged).toHaveLength(1);
    expect(merged[0].oracleUsdPerToken).toBe(95_000);
  });

  it("accepts Phase B oracle over a prior bulk-only row", () => {
    const phaseA = {
      ...baseKey,
      price: "800000",
    } as MarketInfo;
    const phaseB = {
      ...baseKey,
      price: "1000000",
      oracleUsdPerToken: 95_000,
    } as MarketInfo;

    const merged = mergePortfolioMarketRows([phaseA], [phaseB]) as MarketInfo[];
    expect(merged[0].oracleUsdPerToken).toBe(95_000);
  });

  it("takes incoming when neither row has oracle and incoming has USD", () => {
    const older = {
      ...baseKey,
      price: "0",
    } as MarketInfo;
    const newer = {
      ...baseKey,
      price: "1000000",
    } as MarketInfo;

    const merged = mergePortfolioMarketRows([older], [newer]) as MarketInfo[];
    expect(merged[0].price).toBe("1000000");
  });
});
