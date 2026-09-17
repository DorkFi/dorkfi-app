export type RateLimiter = {
  allow: (key: string, now?: number) => boolean;
};

/** Sliding window of `max` hits per `windowMs`. In-memory; one process. */
export function createRateLimiter(opts: {
  max: number;
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now = Date.now()): boolean {
      const cutoff = now - opts.windowMs;
      const prev = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (prev.length >= opts.max) {
        hits.set(key, prev);
        return false;
      }
      prev.push(now);
      hits.set(key, prev);
      return true;
    },
  };
}

const inflight = new Map<string, Promise<unknown>>();

/** Coalesce concurrent work for the same key (single Railway instance). */
export async function withInflightLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const pending = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}
