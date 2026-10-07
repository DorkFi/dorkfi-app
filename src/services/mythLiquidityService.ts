import BigNumber from "bignumber.js";
import {
  getAlgorandNetworkFromNetworkId,
  getAllTokens,
} from "@/config";
import type { LiquidityPoolPairConfig } from "@/constants/liquidityPools";
import { pairLpDecimals } from "@/constants/liquidityPools";
import algorandService from "@/services/algorandService";
import type {
  LiquidityPoolAssetMeta,
  LiquidityPoolSnapshot,
} from "@/services/tinymanLiquidityService";

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== "" && /^-?\d+$/.test(trimmed)) return BigInt(trimmed);
  }
  return 0n;
}

function assetAmountFromAccount(account: unknown, assetId: number): bigint {
  if (account == null || typeof account !== "object") return 0n;
  const row = account as Record<string, unknown>;
  if (assetId === 0) {
    return toBigInt(row.amount);
  }
  const assets = row.assets;
  if (!Array.isArray(assets)) return 0n;
  for (const holding of assets) {
    if (holding == null || typeof holding !== "object") continue;
    const h = holding as Record<string, unknown>;
    const rawId = h.assetId ?? h["asset-id"];
    if (Number(rawId) !== assetId) continue;
    return toBigInt(h.amount);
  }
  return 0n;
}

function fromAtomic(amount: bigint, decimals: number): string {
  return new BigNumber(amount.toString())
    .shiftedBy(-decimals)
    .decimalPlaces(Math.min(decimals, 6), BigNumber.ROUND_DOWN)
    .toFixed();
}

/** Circulating LST = total ASA supply minus the dualSTAKE reserve holding. */
export function circulatingLstSupply(total: bigint, reserve: bigint): bigint {
  return total > reserve ? total - reserve : 0n;
}

export async function fetchMythDualStakeSnapshot(
  pair: LiquidityPoolPairConfig
): Promise<LiquidityPoolSnapshot | null> {
  if (pair.platform !== "myth" || !pair.poolAddr) return null;

  const algodNetwork = getAlgorandNetworkFromNetworkId(pair.networkId);
  if (!algodNetwork) return null;

  try {
    const { algod } = await algorandService.initializeClientsForReads(
      algodNetwork
    );
    const [account, asset] = await Promise.all([
      algod.accountInformation(pair.poolAddr).do(),
      algod.getAssetByID(pair.lpTokenId).do(),
    ]);

    const asset1 = applyPairAssetOverrides(
      pair,
      pair.asset1Id,
      resolveAssetMeta(pair.networkId, pair.asset1Id)
    );
    const asset2 = applyPairAssetOverrides(
      pair,
      pair.asset2Id,
      resolveAssetMeta(pair.networkId, pair.asset2Id)
    );

    const asset1Reserve = assetAmountFromAccount(account, pair.asset1Id);
    const asset2Reserve = assetAmountFromAccount(account, pair.asset2Id);
    const total = toBigInt(
      (asset as { params?: { total?: unknown } }).params?.total
    );
    const reserve = assetAmountFromAccount(account, pair.lpTokenId);

    return {
      pair,
      pool: null,
      reserves: null,
      asset1,
      asset2,
      poolTokenId: pair.lpTokenId,
      totalLiquidity: circulatingLstSupply(total, reserve),
      asset1ReserveHuman: fromAtomic(asset1Reserve, asset1.decimals),
      asset2ReserveHuman: fromAtomic(asset2Reserve, asset2.decimals),
      apr: null,
      poolAddress: pair.poolAddr,
    };
  } catch {
    return null;
  }
}

function resolveAssetMeta(
  networkId: LiquidityPoolPairConfig["networkId"],
  assetId: number
): LiquidityPoolAssetMeta {
  if (assetId === 0) {
    return {
      assetId: 0,
      symbol: "ALGO",
      decimals: 6,
      logoPath: "/lovable-uploads/Algo.webp",
    };
  }
  const tokens = getAllTokens(networkId);
  for (const token of tokens) {
    if (token.isStoken) continue;
    const raw = token.assetId;
    if (!raw || !/^\d+$/.test(raw)) continue;
    if (Number(raw) === assetId) {
      return {
        assetId,
        symbol: token.marketOverride?.displaySymbol ?? token.symbol,
        decimals: token.decimals,
        logoPath: token.logoPath,
      };
    }
  }
  return { assetId, symbol: `ASA ${assetId}`, decimals: 6 };
}

function applyPairAssetOverrides(
  pair: LiquidityPoolPairConfig,
  assetId: number,
  meta: LiquidityPoolAssetMeta
): LiquidityPoolAssetMeta {
  if (assetId !== pair.asset2Id) return meta;
  return {
    ...meta,
    ...(pair.asset2Symbol ? { symbol: pair.asset2Symbol } : {}),
    ...(pair.asset2Decimals != null ? { decimals: pair.asset2Decimals } : {}),
    ...(pair.asset2LogoPath ? { logoPath: pair.asset2LogoPath } : {}),
  };
}

export function mythPoolSharePercent(
  circulating: bigint,
  walletLst: bigint
): number {
  if (circulating <= 0n || walletLst <= 0n) return 0;
  return Number((walletLst * 10_000n) / circulating) / 100;
}

export function lpAtomicToHuman(
  atomic: bigint,
  decimals: number = 6
): number {
  if (atomic <= 0n) return 0;
  return Number(atomic) / 10 ** decimals;
}

export function pairLpAtomicToHuman(
  pair: Pick<LiquidityPoolPairConfig, "lpDecimals">,
  atomic: bigint
): number {
  return lpAtomicToHuman(atomic, pairLpDecimals(pair));
}
