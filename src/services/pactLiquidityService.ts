import BigNumber from "bignumber.js";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import type { LiquidityPoolPairConfig } from "@/constants/liquidityPools";
import algorandService from "@/services/algorandService";
import {
  resolveLiquidityAssetMeta,
  type LiquidityPoolAssetMeta,
} from "@/services/tinymanLiquidityService";

const PACT_POOLS_API = "https://api.pact.fi/api/pools";

type TealValueLike = {
  type?: number;
  uint?: number | bigint | string;
  bytes?: string | Uint8Array;
};

type GlobalStateEntry = {
  key: string | Uint8Array;
  value: TealValueLike;
};

export interface PactApplicationState {
  assetA: bigint;
  assetB: bigint;
  reserveA: bigint;
  reserveB: bigint;
  issuedLp: bigint;
  swapFeeBps: bigint;
  lpAsset: bigint;
}

export interface PactApiMetrics {
  feeBps: number | null;
  /** Percentage points, matching the Tinyman APR badge (8.47 means 8.47%). */
  aprPercent: number | null;
  tvlUsd: number | null;
  volume24hUsd: number | null;
}

export interface PactTierSnapshot {
  pair: LiquidityPoolPairConfig;
  asset1: LiquidityPoolAssetMeta;
  asset2: LiquidityPoolAssetMeta;
  asset1ReserveAtomic: bigint;
  asset2ReserveAtomic: bigint;
  asset1ReserveHuman: string;
  asset2ReserveHuman: string;
  totalLpAtomic: bigint;
  feeBps: number;
  aprPercent: number | null;
  tvlUsd: number | null;
  volume24hUsd: number | null;
}

export function pactAppIdFromPair(pair: LiquidityPoolPairConfig): number | null {
  if (pair.pactAppId != null && pair.pactAppId > 0) return pair.pactAppId;
  const fromAddr = Number(pair.poolAddr);
  return Number.isInteger(fromAddr) && fromAddr > 0 ? fromAddr : null;
}

function readApplicationGlobalState(appResponse: unknown): GlobalStateEntry[] | null {
  const params = (appResponse as { params?: Record<string, unknown> })?.params;
  if (!params) return null;
  const gs = (params.globalState as unknown) ?? params["global-state"];
  return Array.isArray(gs) ? (gs as GlobalStateEntry[]) : null;
}

function decodeGlobalStateKey(key: string | Uint8Array): string {
  if (key instanceof Uint8Array) {
    return Buffer.from(key).toString("utf8");
  }
  try {
    return Buffer.from(key, "base64").toString("utf8");
  } catch {
    return key;
  }
}

function uintFromGlobalValue(value: TealValueLike | undefined): bigint {
  if (value == null || value.uint == null || value.uint === "") return 0n;
  try {
    return BigInt(value.uint as bigint | number | string);
  } catch {
    return 0n;
  }
}

export function parsePactApplicationState(
  entries: GlobalStateEntry[]
): PactApplicationState {
  const byKey = new Map<string, TealValueLike>();
  for (const entry of entries) {
    byKey.set(decodeGlobalStateKey(entry.key), entry.value);
  }
  return {
    assetA: uintFromGlobalValue(byKey.get("asset_a")),
    assetB: uintFromGlobalValue(byKey.get("asset_b")),
    reserveA: uintFromGlobalValue(byKey.get("reserve_a")),
    reserveB: uintFromGlobalValue(byKey.get("reserve_b")),
    issuedLp: uintFromGlobalValue(byKey.get("issued_lp")),
    swapFeeBps: uintFromGlobalValue(byKey.get("swap_fee_bps")),
    lpAsset: uintFromGlobalValue(byKey.get("lp_asset")),
  };
}

function finiteOrNull(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Pact reports `apr_7d` as a fraction (0.0847 → 8.47%). */
export function parsePactApiMetrics(data: unknown): PactApiMetrics {
  const pool = (data ?? {}) as {
    fee_bps?: unknown;
    apr_7d?: unknown;
    tvl_usd?: unknown;
    volume_24h?: unknown;
  };
  const aprFraction = finiteOrNull(pool.apr_7d);
  return {
    feeBps: finiteOrNull(pool.fee_bps),
    aprPercent: aprFraction == null ? null : aprFraction * 100,
    tvlUsd: finiteOrNull(pool.tvl_usd),
    volume24hUsd: finiteOrNull(pool.volume_24h),
  };
}

export function reservesInPairOrder(
  pair: Pick<LiquidityPoolPairConfig, "asset1Id" | "asset2Id">,
  state: Pick<PactApplicationState, "assetA" | "assetB" | "reserveA" | "reserveB">
): { asset1: bigint; asset2: bigint } {
  const byAsset = new Map<number, bigint>([
    [Number(state.assetA), state.reserveA],
    [Number(state.assetB), state.reserveB],
  ]);
  return {
    asset1: byAsset.get(pair.asset1Id) ?? 0n,
    asset2: byAsset.get(pair.asset2Id) ?? 0n,
  };
}

function fromAtomic(amount: bigint, decimals: number): string {
  return new BigNumber(amount.toString())
    .shiftedBy(-decimals)
    .decimalPlaces(Math.min(decimals, 6), BigNumber.ROUND_DOWN)
    .toFixed();
}

export function buildPactTierSnapshot(
  pair: LiquidityPoolPairConfig,
  state: PactApplicationState,
  metrics: PactApiMetrics
): PactTierSnapshot {
  const asset1 = resolveLiquidityAssetMeta(pair.networkId, pair.asset1Id);
  const asset2 = resolveLiquidityAssetMeta(pair.networkId, pair.asset2Id);
  const reserves = reservesInPairOrder(pair, state);
  const feeBps =
    Number(state.swapFeeBps) || metrics.feeBps || pair.feeBps || 0;
  return {
    pair,
    asset1,
    asset2,
    asset1ReserveAtomic: reserves.asset1,
    asset2ReserveAtomic: reserves.asset2,
    asset1ReserveHuman: fromAtomic(reserves.asset1, asset1.decimals),
    asset2ReserveHuman: fromAtomic(reserves.asset2, asset2.decimals),
    totalLpAtomic: state.issuedLp,
    feeBps,
    aprPercent: metrics.aprPercent,
    tvlUsd: metrics.tvlUsd,
    volume24hUsd: metrics.volume24hUsd,
  };
}

async function fetchPactApiMetrics(appId: number): Promise<PactApiMetrics> {
  try {
    const res = await fetch(`${PACT_POOLS_API}/${appId}`);
    if (!res.ok) return parsePactApiMetrics(null);
    return parsePactApiMetrics(await res.json());
  } catch {
    return parsePactApiMetrics(null);
  }
}

export async function fetchPactTierSnapshot(
  pair: LiquidityPoolPairConfig
): Promise<PactTierSnapshot | null> {
  if (pair.platform !== "pact") return null;
  const appId = pactAppIdFromPair(pair);
  const algodNetwork = getAlgorandNetworkFromNetworkId(pair.networkId);
  if (appId == null || !algodNetwork) return null;

  try {
    const { algod } = await algorandService.initializeClientsForReads(algodNetwork);
    const [app, metrics] = await Promise.all([
      algod.getApplicationByID(appId).do(),
      fetchPactApiMetrics(appId),
    ]);
    const entries = readApplicationGlobalState(app);
    if (!entries) return null;
    return buildPactTierSnapshot(pair, parsePactApplicationState(entries), metrics);
  } catch {
    return null;
  }
}
