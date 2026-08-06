import type { NetworkId } from "@/config";
import type { SavingsTxRecord } from "@/services/savingsTransactionHistory";

export type BalanceHistoryEvent = {
  timestamp: number;
  /** +deposit / −withdraw in USD. */
  deltaUsd: number;
  /** Optional scope for portfolio series filters. */
  scope?: "core" | "high_yield" | "wallet";
  assetConfigKey?: string;
};

export type BalanceSnapshot = {
  networkId: NetworkId;
  address: string;
  /** Pool app id, or "portfolio" / "wallet". */
  seriesKey: string;
  timestamp: number;
  balanceUsd: number;
};

export type BalanceChartPoint = {
  label: string;
  value: number;
};

const SNAPSHOT_STORAGE_KEY = "simplfi:savings-balance-snapshots:v1";
const MS_DAY = 86_400_000;
const MS_YEAR = 365.25 * MS_DAY;
/** Min gap between identical-ish snapshots for the same series. */
const SNAPSHOT_THROTTLE_MS = 15 * 60 * 1000;
const SNAPSHOT_MIN_CHANGE_USD = 0.005;

type SnapshotStorage = {
  version: 1;
  records: BalanceSnapshot[];
};

function readSnapshots(): BalanceSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SnapshotStorage;
    if (!parsed || !Array.isArray(parsed.records)) return [];
    return parsed.records;
  } catch {
    return [];
  }
}

function writeSnapshots(records: BalanceSnapshot[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: SnapshotStorage = {
      version: 1,
      // Keep newest first, cap growth.
      records: records
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 500),
    };
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode.
  }
}

export function loadBalanceSnapshots(filters: {
  networkId: NetworkId;
  address: string;
  seriesKey?: string;
}): BalanceSnapshot[] {
  const addr = filters.address.toLowerCase();
  return readSnapshots()
    .filter(
      (r) =>
        r.networkId === filters.networkId &&
        r.address.toLowerCase() === addr &&
        (!filters.seriesKey || r.seriesKey === filters.seriesKey)
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Persist a live balance sample when it meaningfully differs from the last one.
 * Returns whether a new row was stored.
 */
export function maybeAppendBalanceSnapshot(input: {
  networkId: NetworkId;
  address: string;
  seriesKey: string;
  balanceUsd: number;
  timestamp?: number;
  force?: boolean;
}): boolean {
  const balanceUsd = Math.max(0, input.balanceUsd);
  if (!Number.isFinite(balanceUsd)) return false;

  const timestamp = input.timestamp ?? Date.now();
  const all = readSnapshots();
  const addr = input.address.toLowerCase();
  const latest = all.find(
    (r) =>
      r.networkId === input.networkId &&
      r.address.toLowerCase() === addr &&
      r.seriesKey === input.seriesKey
  );

  if (!input.force && latest) {
    const age = timestamp - latest.timestamp;
    const delta = Math.abs(latest.balanceUsd - balanceUsd);
    if (age < SNAPSHOT_THROTTLE_MS && delta < SNAPSHOT_MIN_CHANGE_USD) {
      return false;
    }
    // No meaningful change and not forced — skip stale writes even after throttle
    // only when still identical (keeps storage smaller).
    if (delta < SNAPSHOT_MIN_CHANGE_USD && age < MS_DAY) {
      return false;
    }
  }

  const next: BalanceSnapshot = {
    networkId: input.networkId,
    address: input.address,
    seriesKey: input.seriesKey,
    timestamp,
    balanceUsd,
  };
  writeSnapshots([next, ...all.filter((r) => !(
    r.networkId === next.networkId &&
    r.address.toLowerCase() === addr &&
    r.seriesKey === next.seriesKey &&
    Math.abs(r.timestamp - next.timestamp) < 1000
  ))]);
  return true;
}

function parseHumanAmount(amount: string | undefined): number | null {
  if (amount == null || amount === "") return null;
  const n = Number.parseFloat(String(amount).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Convert savings tx history into signed USD cashflows (deposits/withdrawals only).
 */
export function savingsTxRecordsToEvents(
  records: SavingsTxRecord[],
  priceByAssetKey: Record<string, number | null | undefined>
): BalanceHistoryEvent[] {
  const out: BalanceHistoryEvent[] = [];
  for (const r of records) {
    if (r.kind !== "deposit" && r.kind !== "withdraw") continue;
    const tokens = parseHumanAmount(r.amount);
    if (tokens == null || tokens <= 0) continue;
    const key = r.assetConfigKey ?? "";
    const price = priceByAssetKey[key];
    const px =
      price != null && Number.isFinite(price) && price > 0 ? price : 1;
    const usd = tokens * px;
    out.push({
      timestamp: r.timestamp,
      deltaUsd: r.kind === "deposit" ? usd : -usd,
      assetConfigKey: r.assetConfigKey,
    });
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function annualRateFromApy(apyPercent: number | null | undefined): number {
  if (apyPercent != null && Number.isFinite(apyPercent) && apyPercent > 0) {
    return apyPercent / 100;
  }
  return 0;
}

/** Reverse continuous compounding: bal(t0) given bal(t1) with annual rate. */
function reverseCompound(
  balance: number,
  dtMs: number,
  annual: number
): number {
  if (balance <= 0 || dtMs <= 0 || annual <= 0) return Math.max(0, balance);
  const years = dtMs / MS_YEAR;
  return Math.max(0, balance / Math.pow(1 + annual, years));
}

/** Forward continuous compounding. */
function forwardCompound(
  balance: number,
  dtMs: number,
  annual: number
): number {
  if (balance <= 0 || dtMs <= 0 || annual <= 0) return Math.max(0, balance);
  const years = dtMs / MS_YEAR;
  return Math.max(0, balance * Math.pow(1 + annual, years));
}

type Knot = { t: number; bal: number };

/**
 * Reconstruct balance over time from cash events (reverse-pinned to live) and
 * optional local snapshots, then sample evenly across the selected range.
 */
export function buildTrackedBalanceSeries(params: {
  liveUsd: number;
  apyPercent: number | null;
  earnedInterestUsd?: number;
  rangeDays: number;
  events?: BalanceHistoryEvent[];
  snapshots?: Array<{ timestamp: number; balanceUsd: number }>;
}): BalanceChartPoint[] {
  const days = Math.max(1, params.rangeDays);
  const pointCount = Math.min(48, Math.max(12, Math.round(days / 7) + 1));
  const now = Date.now();
  const startMs = now - days * MS_DAY;
  const live = Math.max(0, params.liveUsd);
  const annual = annualRateFromApy(params.apyPercent);
  const earned = Math.max(0, params.earnedInterestUsd ?? 0);

  const events = (params.events ?? [])
    .filter((e) => Number.isFinite(e.deltaUsd) && e.deltaUsd !== 0)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  const snaps = (params.snapshots ?? [])
    .filter(
      (s) =>
        Number.isFinite(s.balanceUsd) &&
        s.timestamp > 0 &&
        s.timestamp <= now + MS_DAY
    )
    .map((s) => ({
      t: s.timestamp,
      bal: Math.max(0, s.balanceUsd),
    }))
    .sort((a, b) => a.t - b.t);

  const hasCashflow = events.length > 0;
  const hasSnaps = snaps.length > 0;

  let knots: Knot[] = [];

  if (hasCashflow) {
    // Walk reverse from live balance through cashflows to estimate past levels.
    let bal = live;
    let tCursor = now;
    const reverse: Knot[] = [{ t: now, bal: live }];

    const eventsDesc = events
      .filter((e) => e.timestamp <= now)
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp);

    for (const e of eventsDesc) {
      const et = Math.min(e.timestamp, tCursor);
      bal = reverseCompound(bal, tCursor - et, annual);
      // Reverse cashflow: undoing deposit subtracts, undoing withdraw adds.
      bal = Math.max(0, bal - e.deltaUsd);
      reverse.push({ t: et, bal });
      tCursor = et;
    }

    if (tCursor > startMs) {
      bal = reverseCompound(bal, tCursor - startMs, annual);
      reverse.push({ t: startMs, bal });
    }

    knots = reverse.sort((a, b) => a.t - b.t);
  } else if (hasSnaps) {
    knots = snaps.map((s) => ({ t: s.t, bal: s.bal }));
    // Ensure coverage of the window start with first snap projected backward.
    if (knots[0]!.t > startMs) {
      const first = knots[0]!;
      const open = reverseCompound(first.bal, first.t - startMs, annual);
      knots = [{ t: startMs, bal: open }, ...knots];
    }
  } else {
    // Fallback: interest-only arc (no fake market noise) between principal and live.
    const startBal =
      earned > 0 && earned < live
        ? Math.max(0, live - earned)
        : annual > 0
          ? reverseCompound(live, days * MS_DAY, annual)
          : live;
    knots = [
      { t: startMs, bal: startBal },
      { t: now, bal: live },
    ];
  }

  // Overlay snapshots as hard truth at their timestamps.
  if (hasSnaps) {
    const byT = new Map<number, number>();
    for (const k of knots) byT.set(k.t, k.bal);
    for (const s of snaps) byT.set(s.t, s.bal);
    byT.set(now, live);
    knots = Array.from(byT.entries())
      .map(([t, bal]) => ({ t, bal }))
      .sort((a, b) => a.t - b.t);
  } else {
    // Always pin live end.
    knots = knots.filter((k) => k.t < now - 1);
    knots.push({ t: now, bal: live });
    knots.sort((a, b) => a.t - b.t);
  }

  // Ensure a knot at range start for sampling.
  if (knots.length === 0 || knots[0]!.t > startMs + 1) {
    const bal0 = balanceAtTime(knots, startMs, annual);
    knots = [{ t: startMs, bal: bal0 }, ...knots];
  }

  const result: BalanceChartPoint[] = [];
  for (let i = 0; i < pointCount; i++) {
    const t = i / (pointCount - 1);
    const ts = startMs + t * (now - startMs);
    const value =
      i === pointCount - 1 ? live : balanceAtTime(knots, ts, annual);
    result.push({
      label:
        i === pointCount - 1 ? "Today" : formatShortDate(new Date(ts)),
      value: Math.max(0, value),
    });
  }

  return result;
}

/** Interpolate balance at `ts` using piece-wise compound growth between knots. */
function balanceAtTime(knots: Knot[], ts: number, annual: number): number {
  if (knots.length === 0) return 0;
  if (ts <= knots[0]!.t) return Math.max(0, knots[0]!.bal);
  if (ts >= knots[knots.length - 1]!.t) {
    return Math.max(0, knots[knots.length - 1]!.bal);
  }

  let lo = knots[0]!;
  let hi = knots[1]!;
  for (let i = 0; i < knots.length - 1; i++) {
    if (ts >= knots[i]!.t && ts <= knots[i + 1]!.t) {
      lo = knots[i]!;
      hi = knots[i + 1]!;
      break;
    }
  }

  const span = hi.t - lo.t;
  if (span <= 0) return Math.max(0, hi.bal);

  // Prefer forward growth from lo; blend toward hi to absorb cashflow discontinuities.
  const dt = ts - lo.t;
  const grown = forwardCompound(lo.bal, dt, annual);
  const u = dt / span;
  // If hi includes a large deposit at the knot, linear blend in the last segment portion
  // still lands on hi at the end.
  const grownAtHi = forwardCompound(lo.bal, span, annual);
  // Scale path so endpoint matches hi when compound alone would miss cashflow.
  if (Math.abs(grownAtHi - hi.bal) > 1e-9 && grownAtHi > 1e-12) {
    const scale = hi.bal / grownAtHi;
    // Mix unscaled growth early, fully scaled near end so steps read as steps.
    const adj = grown * (1 + (scale - 1) * u);
    return Math.max(0, adj);
  }
  // Smooth toward hi with ease for flat/interest-only segments.
  return Math.max(0, grown * (1 - u) + hi.bal * u);
}

/** @deprecated Prefer buildTrackedBalanceSeries — kept for callers/tests. */
export function buildBalanceHistory(
  balanceUsd: number,
  apyPercent: number | null,
  rangeDays: number,
  earnedInterestUsd = 0
): BalanceChartPoint[] {
  return buildTrackedBalanceSeries({
    liveUsd: balanceUsd,
    apyPercent,
    earnedInterestUsd,
    rangeDays,
  });
}
