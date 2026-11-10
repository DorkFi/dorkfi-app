/**
 * Shared sponsor ledger. One Redis key holds the claim record so every
 * SimplFi instance sees the same drips and the same daily budget.
 *
 * Updates use WATCH/MULTI on a dedicated connection. WATCH is per connection,
 * and the process handles more than one request at a time.
 */
import Redis from "ioredis";
import {
  decideCommit,
  decideRelease,
  decideReserve,
  emptyLedgerState,
  inspectState,
  SponsorLedgerError,
  type LedgerState,
  type SponsorLedger,
} from "./ledger.ts";
import { randomUUID } from "node:crypto";

const KEY = "{sponsor}:v1:ledger";
const ATTEMPTS = 5;

type StoredLedger = { v: 1; state: LedgerState };

function parseStored(raw: string): LedgerState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SponsorLedgerError("Sponsor ledger record is unreadable");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new SponsorLedgerError("Sponsor ledger record is unreadable");
  }
  const row = parsed as Partial<StoredLedger>;
  const state = row.v === 1 ? row.state : undefined;
  if (
    !state ||
    typeof state.reservations !== "object" ||
    state.reservations == null ||
    typeof state.index !== "object" ||
    state.index == null ||
    typeof state.budget !== "object" ||
    state.budget == null ||
    typeof state.live !== "object" ||
    state.live == null ||
    typeof state.counted !== "object" ||
    state.counted == null
  ) {
    throw new SponsorLedgerError("Sponsor ledger record is unreadable");
  }
  return state;
}

function ledgerError(error: unknown): SponsorLedgerError {
  if (error instanceof SponsorLedgerError) return error;
  console.error(
    "[sponsor] ledger",
    error instanceof Error ? error.message : String(error)
  );
  return new SponsorLedgerError("Sponsor ledger is unavailable");
}

export function connectRedisSponsorLedger(url: string): SponsorLedger {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 2_000,
    commandTimeout: 2_000,
  });
  let lastLogAt = 0;
  client.on("error", (error: Error) => {
    const now = Date.now();
    if (now - lastLogAt < 30_000) return;
    lastLogAt = now;
    console.error("[sponsor] redis", error.message);
  });

  async function readState(conn: Redis): Promise<LedgerState> {
    const raw = await conn.get(KEY);
    return raw ? parseStored(raw) : emptyLedgerState();
  }

  async function update<T>(
    mutate: (state: LedgerState) => { state: LedgerState; value: T }
  ): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const conn = client.duplicate();
      conn.on("error", () => {});
      try {
        if (conn.status === "wait") await conn.connect();
        await conn.watch(KEY);
        const state = await readState(conn);
        const out = mutate(state);
        const multi = conn.multi();
        multi.set(KEY, JSON.stringify({ v: 1, state: out.state } satisfies StoredLedger));
        const exec = await multi.exec();
        if (exec) return out.value;
      } catch (error) {
        last = error;
        if (error instanceof SponsorLedgerError) throw error;
        if (attempt >= 2) throw ledgerError(error);
      } finally {
        conn.disconnect();
      }
    }
    throw ledgerError(last ?? new Error("Sponsor ledger contention"));
  }

  return {
    async inspect(args) {
      try {
        if (client.status === "wait") await client.connect();
        const state = await readState(client);
        return inspectState(state, args, args.now ?? Date.now());
      } catch (error) {
        throw ledgerError(error);
      }
    },
    async reserve(args) {
      const now = args.now ?? Date.now();
      return update((state) => {
        const legs = args.legs.map((leg) => ({
          ...leg,
          reservationId: randomUUID(),
        }));
        const out = decideReserve(state, { ...args, now, legs });
        return { state: out.state, value: out.results };
      });
    },
    async commit(id, txHash) {
      await update((state) => {
        const out = decideCommit(state, id, txHash);
        if (!out.ok) {
          throw new SponsorLedgerError(
            "Sponsor ledger commit lost the reservation"
          );
        }
        return { state: out.state, value: undefined };
      });
    },
    async release(id) {
      await update((state) => ({
        state: decideRelease(state, id).state,
        value: undefined,
      }));
    },
  };
}
