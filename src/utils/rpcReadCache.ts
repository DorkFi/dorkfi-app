/**
 * Short-lived in-memory cache for expensive RPC / contract reads.
 * Reduces duplicate calls when modals open and child effects mount together.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
/** Bumped on invalidate so in-flight fetches cannot rewrite a cleared key. */
const keyGeneration = new Map<string, number>();
/** Deduplicate concurrent in-flight requests for the same key. */
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 30_000;

function bumpKeyGeneration(key: string): void {
  keyGeneration.set(key, (keyGeneration.get(key) ?? 0) + 1);
}

function dropKeysWhere(predicate: (key: string) => boolean): void {
  const keys = new Set<string>();
  for (const key of cache.keys()) {
    if (predicate(key)) keys.add(key);
  }
  for (const key of inflight.keys()) {
    if (predicate(key)) keys.add(key);
  }
  for (const key of keys) {
    cache.delete(key);
    inflight.delete(key);
    bumpKeyGeneration(key);
  }
}

export function getRpcReadCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setRpcReadCache<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateRpcReadCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    inflight.clear();
    keyGeneration.clear();
    return;
  }
  dropKeysWhere((key) => key.startsWith(prefix));
}

/** Delete keys matching a predicate (for mid-key patterns like userGlobalPool). */
export function invalidateRpcReadCacheWhere(
  predicate: (key: string) => boolean
): void {
  dropKeysWhere(predicate);
}

/**
 * Clear deposit/borrow/global-user position reads after a successful txn so
 * the next modal open does not show stale 30s-cached balances.
 */
export function invalidateUserPositionRpcCache(
  networkId: string,
  userAddress: string
): void {
  if (!userAddress) return;
  invalidateRpcReadCache(`userDeposit:${networkId}:${userAddress}:`);
  invalidateRpcReadCache(`userBorrow:${networkId}:${userAddress}:`);
  invalidateRpcReadCache(`userGlobal:${networkId}:${userAddress}`);
  // Key shape: userGlobalPool:${networkId}:${poolId}:${userAddress}
  invalidateRpcReadCacheWhere(
    (key) =>
      key.startsWith(`userGlobalPool:${networkId}:`) &&
      key.endsWith(`:${userAddress}`)
  );
}

export type WithRpcReadCacheOptions<T> = {
  /**
   * Return false to skip caching (e.g. failed `null` reads).
   * Defaults to caching everything except `null`.
   */
  shouldCache?: (value: T) => boolean;
};

export async function withRpcReadCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
  options?: WithRpcReadCacheOptions<T>
): Promise<T> {
  const cached = getRpcReadCache<T>(key);
  if (cached !== undefined) return cached;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const generation = keyGeneration.get(key) ?? 0;
  const shouldCache =
    options?.shouldCache ?? ((value: T) => value !== null);

  const promise = fetcher()
    .then((value) => {
      if (
        shouldCache(value) &&
        (keyGeneration.get(key) ?? 0) === generation
      ) {
        setRpcReadCache(key, value, ttlMs);
      }
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Test helper — clear cache + inflight. */
export function __resetRpcReadCacheForTests(): void {
  cache.clear();
  inflight.clear();
  keyGeneration.clear();
}
