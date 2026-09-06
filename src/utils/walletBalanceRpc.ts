/**
 * Short-lived RPC helpers for wallet balances (algod account + ASA holdings).
 * Dedupes concurrent reads and shares an account snapshot across assets.
 */

import type { Algodv2 } from "algosdk";
import { getAccountAssetHoldingAmountAtomic } from "@/utils/algodAccountAssetAmount";
import {
  getRpcReadCache,
  invalidateRpcReadCache,
  withRpcReadCache,
} from "@/utils/rpcReadCache";

export const WALLET_BALANCE_RPC_TTL_MS = 45_000;

function accountInfoCacheKey(address: string): string {
  return `walletAcctInfo:${address}`;
}

function asaHoldingCacheKey(address: string, assetId: number): string {
  return `walletAsaHold:${address}:${assetId}`;
}

function arc200BalanceCacheKey(address: string, contractId: string): string {
  return `walletArc200:${address}:${contractId}`;
}

/** Invalidate cached account / ASA / ARC200 balance reads for an address (or everything). */
export function invalidateWalletBalanceRpc(address?: string): void {
  if (address) {
    invalidateRpcReadCache(`walletAcctInfo:${address}`);
    invalidateRpcReadCache(`walletAsaHold:${address}:`);
    invalidateRpcReadCache(`walletArc200:${address}:`);
  } else {
    invalidateRpcReadCache("walletAcctInfo:");
    invalidateRpcReadCache("walletAsaHold:");
    invalidateRpcReadCache("walletArc200:");
  }
}

export function walletArc200RpcCacheKey(
  address: string,
  contractId: string
): string {
  return arc200BalanceCacheKey(address, contractId);
}

/**
 * Cached `accountInformation` (includes native balance + ASA holdings when present).
 */
export async function getCachedAccountInformation(
  algod: Algodv2,
  address: string,
  opts?: { bypassCache?: boolean }
): Promise<Record<string, unknown>> {
  const key = accountInfoCacheKey(address);
  if (opts?.bypassCache) {
    invalidateRpcReadCache(key);
  }
  return withRpcReadCache(
    key,
    async () =>
      (await algod.accountInformation(address).do()) as unknown as Record<
        string,
        unknown
      >,
    WALLET_BALANCE_RPC_TTL_MS
  );
}

/** Parse ASA holding from an `accountInformation` response; `0n` if not opted in. */
export function asaAmountFromAccountInfo(
  accountInfo: Record<string, unknown> | null | undefined,
  assetId: number
): bigint | null {
  if (!accountInfo || !Number.isFinite(assetId) || assetId <= 0) return null;
  const assets = accountInfo.assets;
  if (!Array.isArray(assets)) return null;

  for (const entry of assets) {
    if (entry == null || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const idRaw = row["asset-id"] ?? row.assetId ?? row["assetId"];
    const id = typeof idRaw === "bigint" ? Number(idRaw) : Number(idRaw);
    if (!Number.isFinite(id) || id !== assetId) continue;
    const amount = row.amount;
    if (amount == null) return 0n;
    try {
      return BigInt(String(amount));
    } catch {
      return 0n;
    }
  }
  // Account info loaded but asset not in list → not opted in / zero.
  return 0n;
}

/**
 * ASA holding in atomic units. Prefers a cached full-account snapshot, then
 * falls back to `accountAssetInformation`.
 */
export async function getCachedAsaHoldingAtomic(
  algod: Algodv2,
  address: string,
  assetId: number,
  opts?: { bypassCache?: boolean }
): Promise<bigint> {
  if (!Number.isFinite(assetId) || assetId <= 0) return 0n;

  if (!opts?.bypassCache) {
    const acct = getRpcReadCache<Record<string, unknown>>(
      accountInfoCacheKey(address)
    );
    if (acct) {
      const fromSnap = asaAmountFromAccountInfo(acct, assetId);
      if (fromSnap != null) return fromSnap;
    }
  }

  const key = asaHoldingCacheKey(address, assetId);
  if (opts?.bypassCache) {
    invalidateRpcReadCache(key);
  }

  return withRpcReadCache(
    key,
    async () => {
      try {
        const info = await algod
          .accountAssetInformation(address, assetId)
          .do();
        return getAccountAssetHoldingAmountAtomic(info) ?? 0n;
      } catch {
        return 0n;
      }
    },
    WALLET_BALANCE_RPC_TTL_MS
  );
}

/**
 * Ensure we have a fresh-enough account snapshot (warms ASA lookups for free).
 * Safe to call on hover / modal open.
 */
export async function warmAccountBalanceSnapshot(
  algod: Algodv2,
  address: string
): Promise<void> {
  await getCachedAccountInformation(algod, address);
}
