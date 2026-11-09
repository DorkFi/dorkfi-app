import { sweepExpiredBorrowShares } from "./borrowShareStore.js";
import { sweepExpiredProfileShares } from "./profileShareStore.js";
import { sweepExpiredRepayShares } from "./repayShareStore.js";

/** How often the share server deletes cards past their TTL. */
export const SHARE_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

export async function sweepAllShareStores(now = Date.now()): Promise<number> {
  const counts = await Promise.all([
    sweepExpiredRepayShares(now),
    sweepExpiredBorrowShares(now),
    sweepExpiredProfileShares(now),
  ]);
  return counts.reduce((sum, count) => sum + count, 0);
}

export function startShareExpirySweep(
  intervalMs = SHARE_SWEEP_INTERVAL_MS
): void {
  const run = () => {
    void sweepAllShareStores().catch((err) => {
      console.error("[share-server] expiry sweep failed", err);
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
}
