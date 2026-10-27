import { describe, expect, it } from "vitest";
import {
  buildPactTierSnapshot,
  parsePactApiMetrics,
  parsePactApplicationState,
  reservesInPairOrder,
} from "@/services/pactLiquidityService";
import type { LiquidityPoolPairConfig } from "@/constants/liquidityPools";

const PAIR: LiquidityPoolPairConfig = {
  id: "pact-algo-wad-100bps",
  cardGroupId: "pact-algo-wad",
  platform: "pact",
  networkId: "algorand-mainnet",
  feeBps: 100,
  lpTokenId: 3738225812,
  lpContractId: 0,
  asset1Id: 0,
  asset2Id: 3334160924,
  label: "ALGO / WAD",
  pactAppId: 3738225809,
  poolAddr: "3738225809",
};

function stateEntry(key: string, uint: number | bigint) {
  return {
    key: Buffer.from(key).toString("base64"),
    value: { type: 2, uint },
  };
}

describe("parsePactApplicationState", () => {
  it("reads reserves, fee, and LP asset from app global state", () => {
    const state = parsePactApplicationState([
      stateEntry("asset_a", 0),
      stateEntry("asset_b", 3334160924),
      stateEntry("reserve_a", 2_202_443_593),
      stateEntry("reserve_b", 257_671_467),
      stateEntry("issued_lp", 752_114_603),
      stateEntry("swap_fee_bps", 100),
      stateEntry("lp_asset", 3738225812),
    ]);
    expect(state.swapFeeBps).toBe(100n);
    expect(state.lpAsset).toBe(3738225812n);
    expect(reservesInPairOrder(PAIR, state)).toEqual({
      asset1: 2_202_443_593n,
      asset2: 257_671_467n,
    });
  });
});

describe("parsePactApiMetrics", () => {
  it("turns the 7-day APR fraction into percentage points", () => {
    expect(
      parsePactApiMetrics({
        fee_bps: 100,
        apr_7d: "0.084708",
        tvl_usd: "506.72244958",
        volume_24h: "70.034530",
      })
    ).toEqual({
      feeBps: 100,
      aprPercent: 8.4708,
      tvlUsd: 506.72244958,
      volume24hUsd: 70.03453,
    });
  });
});

describe("buildPactTierSnapshot", () => {
  it("labels ALGO and WAD reserves in pair order", () => {
    const snapshot = buildPactTierSnapshot(
      PAIR,
      {
        assetA: 0n,
        assetB: 3334160924n,
        reserveA: 2_202_443_593n,
        reserveB: 257_671_467n,
        issuedLp: 752_114_603n,
        swapFeeBps: 100n,
        lpAsset: 3738225812n,
      },
      {
        feeBps: 100,
        aprPercent: 8.4708,
        tvlUsd: 506.72,
        volume24hUsd: 70,
      }
    );
    expect(snapshot.asset1.symbol).toBe("ALGO");
    expect(snapshot.asset2.symbol).toBe("WAD");
    expect(snapshot.asset1ReserveHuman).toBe("2202.443593");
    expect(snapshot.asset2ReserveHuman).toBe("257.671467");
    expect(snapshot.feeBps).toBe(100);
  });
});
