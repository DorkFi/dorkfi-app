/**
 * Fast live TVL / borrowed snapshot from analytics API endpoints.
 * Shared by KPI cards and TVL chart last-point overlay — no market hydrate.
 */

import { dorkfiAPIService } from "@/services/dorkfiAPIService";

const CACHE_TTL_MS = 60_000;

export interface LiveProtocolSnapshot {
  tvl: number;
  borrowed: number;
  fetchedAt: number;
}

let cached: LiveProtocolSnapshot | null = null;
let inFlight: Promise<LiveProtocolSnapshot | null> | null = null;

function isFresh(snapshot: LiveProtocolSnapshot): boolean {
  return (
    Date.now() - snapshot.fetchedAt < CACHE_TTL_MS &&
    Number.isFinite(snapshot.tvl) &&
    snapshot.tvl > 0
  );
}

export function peekLiveProtocolSnapshot(): LiveProtocolSnapshot | null {
  if (cached && isFresh(cached)) return cached;
  return null;
}

export async function fetchLiveProtocolSnapshot(): Promise<LiveProtocolSnapshot | null> {
  const peek = peekLiveProtocolSnapshot();
  if (peek) return peek;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [tvlResponse, borrowedResponse] = await Promise.allSettled([
      dorkfiAPIService.getTVL(),
      dorkfiAPIService.getTotalBorrowed(),
    ]);

    const tvl =
      tvlResponse.status === "fulfilled" && tvlResponse.value.success
        ? tvlResponse.value.data?.totalTVL || 0
        : 0;
    const borrowed =
      borrowedResponse.status === "fulfilled" && borrowedResponse.value.success
        ? borrowedResponse.value.data?.totalBorrowed || 0
        : 0;

    if (!(tvl > 0) && !(borrowed > 0)) return null;

    const snapshot: LiveProtocolSnapshot = {
      tvl,
      borrowed,
      fetchedAt: Date.now(),
    };
    cached = snapshot;
    return snapshot;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

export function __resetLiveProtocolSnapshotForTests(): void {
  cached = null;
  inFlight = null;
}
