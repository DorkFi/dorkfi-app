import { describe, expect, it } from "vitest";
import { resolveAdminMarketIds } from "@/utils/adminMarketIds";

/** Mirrors the historical Admin bug: first token matching symbol wins. */
function resolveBySymbolOnly(
  tokens: Array<{
    symbol: string;
    poolId: string;
    underlyingContractId: string;
  }>,
  assetSymbol: string
): { poolId: string; marketId: string } {
  const token = tokens.find(
    (t) => t.symbol.toLowerCase() === assetSymbol.toLowerCase()
  );
  return {
    poolId: token?.poolId ?? "",
    marketId: token?.underlyingContractId ?? "",
  };
}

describe("resolveAdminMarketIds", () => {
  const legacyWbtc = {
    symbol: "wBTC",
    poolId: "3333688282",
    underlyingContractId: "3211827406",
  };
  const folksWbtc = {
    symbol: "wBTC",
    poolId: "3333688282",
    underlyingContractId: "3575837891",
  };
  const otherPoolWbtc = {
    symbol: "wBTC",
    poolId: "3207735602",
    underlyingContractId: "3211827406",
  };

  it("uses config row pool + contract (not symbol) for Folks vs legacy wBTC", () => {
    const tokens = [legacyWbtc, folksWbtc];

    const folksIds = resolveAdminMarketIds(
      {
        poolId: folksWbtc.poolId,
        underlyingContractId: folksWbtc.underlyingContractId,
      },
      {
        poolId: folksWbtc.poolId,
        marketInfo: {
          poolId: folksWbtc.poolId,
          // Stale / wrong if someone only keyed by symbol
          marketId: legacyWbtc.underlyingContractId,
        },
      }
    );

    expect(folksIds).toEqual({
      poolId: folksWbtc.poolId,
      marketId: folksWbtc.underlyingContractId,
    });

    // Regression guard: symbol-only find always returns the first wBTC.
    const bySymbol = resolveBySymbolOnly(tokens, "wBTC");
    expect(bySymbol.marketId).toBe(legacyWbtc.underlyingContractId);
    expect(bySymbol.marketId).not.toBe(folksIds.marketId);
  });

  it("disambiguates same underlying across different pools", () => {
    const ids = resolveAdminMarketIds(
      {
        poolId: otherPoolWbtc.poolId,
        underlyingContractId: otherPoolWbtc.underlyingContractId,
      },
      {
        poolId: legacyWbtc.poolId,
        marketInfo: {
          poolId: legacyWbtc.poolId,
          marketId: legacyWbtc.underlyingContractId,
        },
      }
    );

    expect(ids).toEqual({
      poolId: otherPoolWbtc.poolId,
      marketId: otherPoolWbtc.underlyingContractId,
    });
  });

  it("falls back to marketInfo when config ids are missing", () => {
    expect(
      resolveAdminMarketIds(
        {},
        {
          marketInfo: {
            poolId: folksWbtc.poolId,
            marketId: folksWbtc.underlyingContractId,
          },
        }
      )
    ).toEqual({
      poolId: folksWbtc.poolId,
      marketId: folksWbtc.underlyingContractId,
    });
  });

  it("returns empty strings when nothing is available", () => {
    expect(resolveAdminMarketIds({})).toEqual({ poolId: "", marketId: "" });
  });
});
