import { describe, expect, it } from "vitest";
import {
  createLedgerBox,
  createMemorySponsorLedger,
  SPONSOR_PENDING_TTL_MS,
  type BudgetLimits,
  type SponsorIdentity,
} from "../ledger";

const LIMITS: BudgetLimits = {
  maxDrips: 2,
  maxEthWei: 1_000n,
  maxAlgoMicro: 1_000n,
};

const USER: SponsorIdentity = {
  userId: "user-1",
  evmAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  algorandAddress: "ALGO_A",
};

const NOW = 1_700_000_000_000;

describe("sponsor ledger", () => {
  it("blocks a second send while the first claim is pending, then allows it after expiry", async () => {
    const ledger = createMemorySponsorLedger();
    const limits: BudgetLimits = {
      maxDrips: 1,
      maxEthWei: 100n,
      maxAlgoMicro: 100n,
    };
    const first = await ledger.reserve({
      ...USER,
      now: NOW,
      limits,
      legs: [
        { leg: "eth", amount: 100n },
        { leg: "algo", amount: 100n },
      ],
    });
    expect(first.eth?.status).toBe("reserved");
    expect(first.algo?.status).toBe("reserved");

    const pending = await ledger.reserve({
      ...USER,
      now: NOW + 1_000,
      limits,
      legs: [
        { leg: "eth", amount: 100n },
        { leg: "algo", amount: 100n },
      ],
    });
    expect(pending.eth).toEqual({ status: "skip", reason: "pending" });
    expect(pending.algo).toEqual({ status: "skip", reason: "pending" });

    const expired = await ledger.reserve({
      ...USER,
      now: NOW + SPONSOR_PENDING_TTL_MS + 1,
      limits,
      legs: [
        { leg: "eth", amount: 100n },
        { leg: "algo", amount: 100n },
      ],
    });
    expect(expired.eth?.status).toBe("reserved");
    expect(expired.algo?.status).toBe("reserved");
  });

  it("keeps a committed drip after the pending window", async () => {
    const ledger = createMemorySponsorLedger();
    const reserved = await ledger.reserve({
      ...USER,
      now: NOW,
      limits: LIMITS,
      legs: [
        { leg: "eth", amount: 100n },
        { leg: "algo", amount: 100n },
      ],
    });
    if (reserved.eth?.status !== "reserved" || reserved.algo?.status !== "reserved") {
      throw new Error("expected both legs to reserve");
    }
    await ledger.commit(reserved.eth.id, "0xeth");
    await ledger.commit(reserved.algo.id, "algo");

    const later = await ledger.reserve({
      ...USER,
      now: NOW + SPONSOR_PENDING_TTL_MS + 1,
      limits: LIMITS,
      legs: [
        { leg: "eth", amount: 100n },
        { leg: "algo", amount: 100n },
      ],
    });
    expect(later.eth).toEqual({ status: "skip", reason: "already_sponsored" });
    expect(later.algo).toEqual({ status: "skip", reason: "already_sponsored" });
    expect((await ledger.inspect({ ...USER, now: NOW + SPONSOR_PENDING_TTL_MS + 1 })).eth).toBe(
      "sent"
    );
  });

  it("returns the daily slot when a send is released", async () => {
    const ledger = createMemorySponsorLedger();
    const limits: BudgetLimits = {
      maxDrips: 1,
      maxEthWei: 100n,
      maxAlgoMicro: 100n,
    };
    const reserved = await ledger.reserve({
      ...USER,
      now: NOW,
      limits,
      legs: [{ leg: "eth", amount: 100n }],
    });
    if (reserved.eth?.status !== "reserved") throw new Error("expected a reservation");
    await ledger.release(reserved.eth.id);

    const other = await ledger.reserve({
      userId: "user-2",
      evmAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      algorandAddress: "ALGO_B",
      now: NOW + 1,
      limits,
      legs: [{ leg: "eth", amount: 100n }],
    });
    expect(other.eth?.status).toBe("reserved");
  });

  it("lets a partial drip finish without taking a second daily slot", async () => {
    const ledger = createMemorySponsorLedger();
    const limits: BudgetLimits = {
      maxDrips: 1,
      maxEthWei: 1_000n,
      maxAlgoMicro: 1_000n,
    };
    const reserved = await ledger.reserve({
      ...USER,
      now: NOW,
      limits,
      legs: [
        { leg: "eth", amount: 100n },
        { leg: "algo", amount: 100n },
      ],
    });
    if (reserved.eth?.status !== "reserved" || reserved.algo?.status !== "reserved") {
      throw new Error("expected both legs to reserve");
    }
    await ledger.commit(reserved.eth.id, "0xeth");
    await ledger.release(reserved.algo.id);

    const other = await ledger.reserve({
      userId: "user-2",
      evmAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      algorandAddress: "ALGO_B",
      now: NOW + 1,
      limits,
      legs: [{ leg: "eth", amount: 100n }],
    });
    expect(other.eth).toEqual({ status: "skip", reason: "daily_budget" });

    const finish = await ledger.reserve({
      ...USER,
      now: NOW + 2,
      limits,
      legs: [{ leg: "algo", amount: 100n }],
    });
    expect(finish.algo?.status).toBe("reserved");
  });

  it("does not consume a drip slot when both amounts are over budget", async () => {
    const ledger = createMemorySponsorLedger();
    const blocked = await ledger.reserve({
      ...USER,
      now: NOW,
      limits: { maxDrips: 1, maxEthWei: 10n, maxAlgoMicro: 10n },
      legs: [
        { leg: "eth", amount: 100n },
        { leg: "algo", amount: 100n },
      ],
    });
    expect(blocked.eth).toEqual({ status: "skip", reason: "daily_budget" });
    expect(blocked.algo).toEqual({ status: "skip", reason: "daily_budget" });

    const next = await ledger.reserve({
      ...USER,
      now: NOW + 1,
      limits: LIMITS,
      legs: [{ leg: "eth", amount: 100n }],
    });
    expect(next.eth?.status).toBe("reserved");
  });

  it("blocks the same Base address for a different user", async () => {
    const ledger = createMemorySponsorLedger();
    const reserved = await ledger.reserve({
      ...USER,
      now: NOW,
      limits: LIMITS,
      legs: [{ leg: "eth", amount: 100n }],
    });
    if (reserved.eth?.status !== "reserved") throw new Error("expected a reservation");
    await ledger.commit(reserved.eth.id, "0xeth");
    const other = await ledger.reserve({
      userId: "user-2",
      evmAddress: USER.evmAddress,
      algorandAddress: "ALGO_B",
      now: NOW + 1,
      limits: LIMITS,
      legs: [{ leg: "eth", amount: 100n }],
    });
    expect(other.eth).toEqual({ status: "skip", reason: "already_sponsored" });
  });

  it("is visible to a second instance sharing the same store", async () => {
    const box = createLedgerBox();
    const first = createMemorySponsorLedger(box);
    const second = createMemorySponsorLedger(box);
    const reserved = await first.reserve({
      ...USER,
      now: NOW,
      limits: LIMITS,
      legs: [{ leg: "eth", amount: 100n }],
    });
    if (reserved.eth?.status !== "reserved") throw new Error("expected a reservation");
    await first.commit(reserved.eth.id, "0xeth");
    expect((await second.inspect({ ...USER, now: NOW + 1 })).eth).toBe("sent");
  });
});
