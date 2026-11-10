/**
 * Durable cap for Easy Start drips.
 *
 * A successful leg is stored under the Privy user, the Base address, and the
 * derived Algorand address. Any of those keys blocks that leg again. The daily
 * budget is reserved in the same update as the claim and returned if the send
 * fails before a transaction hash exists.
 *
 * Pending claims block a second send until they expire, so a crash after
 * broadcast does not immediately pay twice. Tests use the in-memory ledger.
 * Production uses Redis (`SPONSOR_REDIS_URL`) and refuses to send without it.
 */
import { randomUUID } from "node:crypto";

export const SPONSOR_PENDING_TTL_MS = 5 * 60 * 1000;

export type LegName = "eth" | "algo";
export type LegView = "free" | "sent" | "pending";
export type SkipReason = "already_sponsored" | "pending" | "daily_budget";

export type BudgetLimits = {
  maxDrips: number;
  maxEthWei: bigint;
  maxAlgoMicro: bigint;
};

export type SponsorIdentity = {
  userId: string;
  evmAddress: string;
  algorandAddress: string;
};

export type ReserveLegResult =
  | { status: "reserved"; id: string }
  | { status: "skip"; reason: SkipReason };

export type ReserveResults = Partial<Record<LegName, ReserveLegResult>>;

export class SponsorLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SponsorLedgerError";
  }
}

export type SponsorLedger = {
  inspect(
    args: SponsorIdentity & { now?: number }
  ): Promise<Record<LegName, LegView>>;
  reserve(args: SponsorIdentity & {
    legs: Array<{ leg: LegName; amount: bigint }>;
    limits: BudgetLimits;
    now?: number;
  }): Promise<ReserveResults>;
  commit(id: string, txHash: string): Promise<void>;
  release(id: string): Promise<void>;
};

type Reservation = {
  id: string;
  leg: LegName;
  userId: string;
  evmAddress: string;
  algorandAddress: string;
  amount: string;
  day: string;
  status: "pending" | "sent";
  expiresAt: number;
  txHash?: string;
};

type DayBudget = {
  count: number;
  eth: string;
  algo: string;
};

export type LedgerState = {
  reservations: Record<string, Reservation>;
  index: Record<string, string>;
  budget: Record<string, DayBudget>;
  /** `${day}|${userId}` -> live reservations created that day. */
  live: Record<string, number>;
  /** `${day}|${userId}` set when this user took a drip slot that day. */
  counted: Record<string, true>;
};

export type LedgerBox = { state: LedgerState };

type LegRequest = { leg: LegName; amount: bigint; reservationId: string };

export function emptyLedgerState(): LedgerState {
  return {
    reservations: {},
    index: {},
    budget: {},
    live: {},
    counted: {},
  };
}

export function createLedgerBox(): LedgerBox {
  return { state: emptyLedgerState() };
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function dayUser(day: string, userId: string): string {
  return JSON.stringify([day, userId]);
}

function indexKey(
  leg: LegName,
  kind: "user" | "evm" | "algo",
  id: string
): string {
  return JSON.stringify([leg, kind, id]);
}

function legKeys(leg: LegName, identity: SponsorIdentity): string[] {
  return [
    indexKey(leg, "user", identity.userId),
    indexKey(leg, "evm", identity.evmAddress),
    indexKey(leg, "algo", identity.algorandAddress),
  ];
}

function reservationKeys(rsv: Reservation): string[] {
  return [
    indexKey(rsv.leg, "user", rsv.userId),
    indexKey(rsv.leg, "evm", rsv.evmAddress),
    indexKey(rsv.leg, "algo", rsv.algorandAddress),
  ];
}

function cloneState(state: LedgerState): LedgerState {
  const reservations: Record<string, Reservation> = {};
  for (const [id, rsv] of Object.entries(state.reservations)) {
    reservations[id] = { ...rsv };
  }
  const budget: Record<string, DayBudget> = {};
  for (const [day, row] of Object.entries(state.budget)) {
    budget[day] = { ...row };
  }
  return {
    reservations,
    index: { ...state.index },
    budget,
    live: { ...state.live },
    counted: { ...state.counted },
  };
}

function readReservation(state: LedgerState, id: string): Reservation {
  const rsv = state.reservations[id];
  if (!rsv) {
    throw new SponsorLedgerError("Sponsor ledger record is unreadable");
  }
  return rsv;
}

export function inspectState(
  state: LedgerState,
  identity: SponsorIdentity,
  now: number
): Record<LegName, LegView> {
  return {
    eth: legStatus(state, "eth", identity, now),
    algo: legStatus(state, "algo", identity, now),
  };
}

function legStatus(
  state: LedgerState,
  leg: LegName,
  identity: SponsorIdentity,
  now: number
): LegView {
  let pending = false;
  for (const key of legKeys(leg, identity)) {
    const id = state.index[key];
    if (!id) continue;
    const rsv = readReservation(state, id);
    if (rsv.status === "sent") return "sent";
    if (rsv.status === "pending" && rsv.expiresAt > now) pending = true;
  }
  return pending ? "pending" : "free";
}

function userHoldsSlot(
  state: LedgerState,
  userId: string,
  day: string,
  now: number
): boolean {
  if ((state.live[dayUser(day, userId)] ?? 0) > 0) return true;
  for (const leg of ["eth", "algo"] as const) {
    const id = state.index[indexKey(leg, "user", userId)];
    if (!id) continue;
    const rsv = readReservation(state, id);
    if (rsv.status === "sent") return true;
    if (rsv.status === "pending" && rsv.expiresAt > now) return true;
  }
  return false;
}

function ensureBudget(state: LedgerState, day: string): DayBudget {
  const existing = state.budget[day];
  if (existing) return existing;
  const created = { count: 0, eth: "0", algo: "0" };
  state.budget[day] = created;
  return created;
}

function pruneBudget(state: LedgerState, day: string): void {
  const row = state.budget[day];
  if (!row) return;
  if (row.count === 0 && row.eth === "0" && row.algo === "0") {
    delete state.budget[day];
  }
}

function subAmount(current: string, amount: string): string {
  const next = BigInt(current) - BigInt(amount);
  return (next < 0n ? 0n : next).toString();
}

function releaseReservation(state: LedgerState, id: string): void {
  const rsv = state.reservations[id];
  if (!rsv || rsv.status !== "pending") return;
  for (const key of reservationKeys(rsv)) {
    if (state.index[key] === id) delete state.index[key];
  }
  delete state.reservations[id];
  const liveKey = dayUser(rsv.day, rsv.userId);
  const live = state.live[liveKey] ?? 0;
  if (live <= 1) {
    delete state.live[liveKey];
    if (state.counted[liveKey]) {
      delete state.counted[liveKey];
      const budget = ensureBudget(state, rsv.day);
      budget.count = Math.max(0, budget.count - 1);
    }
  } else {
    state.live[liveKey] = live - 1;
  }
  const budget = ensureBudget(state, rsv.day);
  if (rsv.leg === "eth") budget.eth = subAmount(budget.eth, rsv.amount);
  else budget.algo = subAmount(budget.algo, rsv.amount);
  pruneBudget(state, rsv.day);
}

export function decideReserve(
  state: LedgerState,
  args: SponsorIdentity & {
    legs: LegRequest[];
    limits: BudgetLimits;
    now: number;
  }
): { state: LedgerState; results: ReserveResults } {
  const next = cloneState(state);
  const now = args.now;
  const day = utcDay(now);

  for (const leg of args.legs) {
    for (const key of legKeys(leg.leg, args)) {
      const id = next.index[key];
      if (!id) continue;
      const rsv = readReservation(next, id);
      if (rsv.status === "pending" && rsv.expiresAt <= now) {
        releaseReservation(next, id);
      }
    }
  }

  const results: ReserveResults = {};
  const candidates: LegRequest[] = [];
  for (const leg of args.legs) {
    const status = legStatus(next, leg.leg, args, now);
    if (status === "sent") {
      results[leg.leg] = { status: "skip", reason: "already_sponsored" };
    } else if (status === "pending") {
      results[leg.leg] = { status: "skip", reason: "pending" };
    } else {
      candidates.push(leg);
    }
  }
  if (candidates.length === 0) return { state: next, results };

  const budget = next.budget[day] ?? { count: 0, eth: "0", algo: "0" };
  const countNeeded = userHoldsSlot(next, args.userId, day, now) ? 0 : 1;
  if (budget.count + countNeeded > args.limits.maxDrips) {
    for (const leg of candidates) {
      results[leg.leg] = { status: "skip", reason: "daily_budget" };
    }
    return { state: next, results };
  }

  let eth = BigInt(budget.eth);
  let algo = BigInt(budget.algo);
  const accepted: LegRequest[] = [];
  for (const leg of candidates) {
    if (leg.leg === "eth") {
      if (eth + leg.amount > args.limits.maxEthWei) {
        results.eth = { status: "skip", reason: "daily_budget" };
        continue;
      }
      eth += leg.amount;
    } else if (algo + leg.amount > args.limits.maxAlgoMicro) {
      results.algo = { status: "skip", reason: "daily_budget" };
      continue;
    } else {
      algo += leg.amount;
    }
    accepted.push(leg);
  }
  if (accepted.length === 0) return { state: next, results };

  if (countNeeded === 1) {
    const row = ensureBudget(next, day);
    row.count += 1;
    next.counted[dayUser(day, args.userId)] = true;
  }

  for (const leg of accepted) {
    const reservation: Reservation = {
      id: leg.reservationId,
      leg: leg.leg,
      userId: args.userId,
      evmAddress: args.evmAddress,
      algorandAddress: args.algorandAddress,
      amount: leg.amount.toString(),
      day,
      status: "pending",
      expiresAt: now + SPONSOR_PENDING_TTL_MS,
    };
    next.reservations[reservation.id] = reservation;
    for (const key of legKeys(leg.leg, args)) {
      next.index[key] = reservation.id;
    }
    const row = ensureBudget(next, day);
    if (leg.leg === "eth") {
      row.eth = (BigInt(row.eth) + leg.amount).toString();
    } else {
      row.algo = (BigInt(row.algo) + leg.amount).toString();
    }
    const liveKey = dayUser(day, args.userId);
    next.live[liveKey] = (next.live[liveKey] ?? 0) + 1;
    results[leg.leg] = { status: "reserved", id: reservation.id };
  }

  return { state: next, results };
}

export function decideCommit(
  state: LedgerState,
  id: string,
  txHash: string
): { state: LedgerState; ok: boolean } {
  const existing = state.reservations[id];
  if (!existing) return { state, ok: false };
  if (existing.status === "sent") {
    return { state, ok: existing.txHash === txHash };
  }
  for (const key of reservationKeys(existing)) {
    if (state.index[key] !== id) return { state, ok: false };
  }
  const next = cloneState(state);
  next.reservations[id] = { ...existing, status: "sent", txHash };
  return { state: next, ok: true };
}

export function decideRelease(
  state: LedgerState,
  id: string
): { state: LedgerState } {
  const existing = state.reservations[id];
  if (!existing || existing.status !== "pending") return { state };
  const next = cloneState(state);
  releaseReservation(next, id);
  return { state: next };
}

export function createMemorySponsorLedger(
  box: LedgerBox = createLedgerBox()
): SponsorLedger {
  return {
    async inspect(args) {
      const now = args.now ?? Date.now();
      return {
        eth: legStatus(box.state, "eth", args, now),
        algo: legStatus(box.state, "algo", args, now),
      };
    },
    async reserve(args) {
      const now = args.now ?? Date.now();
      const legs = args.legs.map((leg) => ({
        ...leg,
        reservationId: randomUUID(),
      }));
      const out = decideReserve(box.state, { ...args, now, legs });
      box.state = out.state;
      return out.results;
    },
    async commit(id, txHash) {
      const out = decideCommit(box.state, id, txHash);
      if (!out.ok) {
        throw new SponsorLedgerError(
          "Sponsor ledger commit lost the reservation"
        );
      }
      box.state = out.state;
    },
    async release(id) {
      box.state = decideRelease(box.state, id).state;
    },
  };
}

function unavailableSponsorLedger(): SponsorLedger {
  const fail = (): Promise<never> =>
    Promise.reject(
      new SponsorLedgerError("Sponsor ledger is not configured")
    );
  return {
    inspect: fail,
    reserve: fail,
    commit: fail,
    release: fail,
  };
}

let singleton: { url: string; ledger: SponsorLedger } | null = null;

export function ledgerForEnv(env: { redisUrl?: string }): SponsorLedger {
  if (!env.redisUrl) return unavailableSponsorLedger();
  if (singleton && singleton.url === env.redisUrl) return singleton.ledger;
  singleton = {
    url: env.redisUrl,
    ledger: createRedisSponsorLedger(env.redisUrl),
  };
  return singleton.ledger;
}

function createRedisSponsorLedger(url: string): SponsorLedger {
  // Loaded on first use so unit tests never open a Redis client.
  let pending: Promise<SponsorLedger> | null = null;
  const ready = (): Promise<SponsorLedger> => {
    pending ??= import("./redisLedger.ts").then((mod) =>
      mod.connectRedisSponsorLedger(url)
    );
    return pending;
  };
  return {
    inspect: (args) => ready().then((ledger) => ledger.inspect(args)),
    reserve: (args) => ready().then((ledger) => ledger.reserve(args)),
    commit: (id, txHash) => ready().then((ledger) => ledger.commit(id, txHash)),
    release: (id) => ready().then((ledger) => ledger.release(id)),
  };
}
