import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import {
  isSponsorConfigured,
  isSponsorLive,
  loadSponsorEnv,
  parseAlgoMnemonic,
  parseBoolFlag,
  parseEthPrivateKey,
  parsePositiveBigInt,
  type SponsorEnv,
} from "../env";
import { assertWalletOwnedByUser, collectWalletAddresses } from "../privyWallets";
import { AuthError } from "../../offramp/privyAuth";
import { createRateLimiter, withInflightLock } from "../rateLimit";
import {
  spendableAlgoMicroAlgosFromAccount,
  sponsorPaymentFeeMicro,
  sponsorSendErrorMessage,
  sponsorTreasuryShortfall,
} from "../spendable";
import {
  handleSponsor,
  runSponsorJob,
  type SponsorHandlerDeps,
  type SponsorResult,
} from "../handlers";
import type { SponsorChain } from "../chain";
import {
  createLedgerBox,
  createMemorySponsorLedger,
  SponsorLedgerError,
} from "../ledger";

const VALID_KEY =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon invest";

describe("parseBoolFlag", () => {
  it("accepts true/1/yes", () => {
    expect(parseBoolFlag("true")).toBe(true);
    expect(parseBoolFlag("1")).toBe(true);
    expect(parseBoolFlag("YES")).toBe(true);
    expect(parseBoolFlag("false")).toBe(false);
    expect(parseBoolFlag(undefined)).toBe(false);
  });
});

describe("parseEthPrivateKey", () => {
  it("normalizes with or without 0x", () => {
    expect(parseEthPrivateKey(VALID_KEY.slice(2))).toBe(VALID_KEY);
    expect(parseEthPrivateKey(VALID_KEY.toUpperCase())).toBe(VALID_KEY);
    expect(parseEthPrivateKey("0xabc")).toBeUndefined();
  });
});

describe("parseAlgoMnemonic", () => {
  it("requires 25 words", () => {
    expect(parseAlgoMnemonic(MNEMONIC)?.split(" ")).toHaveLength(25);
    expect(parseAlgoMnemonic("only twelve words here")).toBeUndefined();
  });
});

describe("parsePositiveBigInt", () => {
  it("falls back when empty or invalid", () => {
    expect(parsePositiveBigInt(undefined, 3n)).toBe(3n);
    expect(parsePositiveBigInt("0", 3n)).toBe(3n);
    expect(parsePositiveBigInt("42", 3n)).toBe(42n);
  });
});

describe("loadSponsorEnv", () => {
  it("defaults to disabled and unconfigured", () => {
    const env = loadSponsorEnv({});
    expect(env.enabled).toBe(false);
    expect(isSponsorConfigured(env)).toBe(false);
    expect(isSponsorLive(env)).toBe(false);
    expect(env.ethAmountWei).toBe(100_000_000_000_000n);
    expect(env.algoMicro).toBe(1_000_000n);
    expect(env.redisUrl).toBeUndefined();
    expect(env.dailyMaxDrips).toBe(50);
    expect(env.dailyMaxEthWei).toBe(5_000_000_000_000_000n);
    expect(env.dailyMaxAlgoMicro).toBe(50_000_000n);
  });

  it("stays offline until the shared ledger is configured", () => {
    const env = loadSponsorEnv({
      SPONSOR_ENABLED: "true",
      PRIVY_APP_SECRET: "secret",
      SPONSOR_ETH_PRIVATE_KEY: VALID_KEY,
      SPONSOR_ALGO_MNEMONIC: MNEMONIC,
    });
    expect(isSponsorConfigured(env)).toBe(true);
    expect(isSponsorLive(env)).toBe(false);
  });

  it("is live only when the shared ledger is configured too", () => {
    const env = loadSponsorEnv({
      SPONSOR_ENABLED: "true",
      PRIVY_APP_SECRET: "secret",
      SPONSOR_ETH_PRIVATE_KEY: VALID_KEY,
      SPONSOR_ALGO_MNEMONIC: MNEMONIC,
      SPONSOR_REDIS_URL: "redis://127.0.0.1:6379",
    });
    expect(isSponsorLive(env)).toBe(true);
  });
});

describe("collectWalletAddresses", () => {
  it("reads linked_accounts and embedded wallets", () => {
    const addrs = collectWalletAddresses({
      linked_accounts: [
        { type: "email", address: "a@b.c" },
        {
          type: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
      embedded_wallets: [
        { address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
      ],
    });
    expect(addrs.map((a) => a.toLowerCase()).sort()).toEqual([
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);
  });
});

describe("spendableAlgoMicroAlgosFromAccount", () => {
  it("subtracts min-balance", () => {
    expect(
      spendableAlgoMicroAlgosFromAccount({
        amount: 1_000_000,
        minBalance: 100_000,
      })
    ).toBe(900_000n);
    expect(
      spendableAlgoMicroAlgosFromAccount({
        amount: 50_000,
        "min-balance": 100_000,
      })
    ).toBe(0n);
  });
});

describe("sponsor treasury preflight", () => {
  it("uses the suggested min fee, otherwise 1000 microALGO", () => {
    expect(sponsorPaymentFeeMicro({ minFee: 1000n, fee: 0 })).toBe(1000n);
    expect(sponsorPaymentFeeMicro({})).toBe(1000n);
  });

  it("rejects a treasury that cannot cover the payment plus fee", () => {
    expect(
      sponsorTreasuryShortfall({
        spendableMicro: 1_000_000n,
        amountMicro: 5_000_000n,
        feeMicro: 1_000n,
      })
    ).toMatch(/treasury is short/);
    expect(
      sponsorTreasuryShortfall({
        spendableMicro: 5_001_000n,
        amountMicro: 5_000_000n,
        feeMicro: 1_000n,
      })
    ).toBeNull();
  });

  it("keeps the algod message for the sponsor log", () => {
    expect(sponsorSendErrorMessage(new Error("overspend"), "Could not send ALGO")).toBe(
      "overspend"
    );
    expect(sponsorSendErrorMessage(new Error("  "), "Could not send ALGO")).toBe(
      "Could not send ALGO"
    );
  });
});

describe("createRateLimiter", () => {
  it("caps hits inside the window", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1_000 });
    expect(limiter.allow("u", 1_000)).toBe(true);
    expect(limiter.allow("u", 1_100)).toBe(true);
    expect(limiter.allow("u", 1_200)).toBe(false);
    expect(limiter.allow("u", 2_200)).toBe(true);
  });
});

function mockChain(overrides: Partial<SponsorChain> = {}): SponsorChain {
  return {
    deriveAlgorandAddress: async (evmAddress) =>
      evmAddress.toLowerCase() === ADDR_B.toLowerCase()
        ? "ALGORANDADDRESSBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
        : "ALGORANDADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    fetchEthBalanceWei: async () => 0n,
    fetchAlgoSpendableMicro: async () => 0n,
    sendEth: async () => "0xeth",
    sendAlgo: async () => "algotx",
    ...overrides,
  };
}

const ADDR = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
const ADDR_B = getAddress("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

function liveEnv(overrides: Record<string, string | undefined> = {}): SponsorEnv {
  return loadSponsorEnv({
    SPONSOR_ENABLED: "true",
    PRIVY_APP_SECRET: "secret",
    SPONSOR_ETH_PRIVATE_KEY: VALID_KEY,
    SPONSOR_ALGO_MNEMONIC: MNEMONIC,
    ...overrides,
  });
}

describe("runSponsorJob", () => {
  const env = liveEnv();

  it("sends both when balances are short", async () => {
    const result: SponsorResult = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      mockChain(),
      createMemorySponsorLedger()
    );
    expect(result.eth.status).toBe("sent");
    expect(result.eth.txHash).toBe("0xeth");
    expect(result.algo.status).toBe("sent");
    expect(result.algo.txHash).toBe("algotx");
    expect(result.algorandAddress).toBeTruthy();
  });

  it("skips when already funded and does not consume a drip", async () => {
    const ledger = createMemorySponsorLedger();
    const funded = mockChain({
      fetchEthBalanceWei: async () => 50_000_000_000_000n,
      fetchAlgoSpendableMicro: async () => 100_000n,
    });
    const result = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      funded,
      ledger
    );
    expect(result.eth).toEqual({ status: "skipped", reason: "already_funded" });
    expect(result.algo).toEqual({ status: "skipped", reason: "already_funded" });

    const later = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      mockChain(),
      ledger
    );
    expect(later.eth.status).toBe("sent");
    expect(later.algo.status).toBe("sent");
  });

  it("records a send error without throwing", async () => {
    const result = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      mockChain({
        sendEth: async () => {
          throw new Error("rpc down");
        },
        fetchAlgoSpendableMicro: async () => 1_000_000n,
      }),
      createMemorySponsorLedger()
    );
    expect(result.eth.status).toBe("error");
    expect(result.algo.status).toBe("skipped");
  });

  it("retries only the leg that failed", async () => {
    const ledger = createMemorySponsorLedger();
    let algoFails = true;
    const chain = mockChain({
      sendAlgo: async () => {
        if (algoFails) throw new Error("algod down");
        return "algotx-2";
      },
    });
    const first = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      chain,
      ledger
    );
    expect(first.eth.status).toBe("sent");
    expect(first.algo.status).toBe("error");
    expect(first.algo.error).toBe("algod down");

    algoFails = false;
    const second = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      chain,
      ledger
    );
    expect(second.eth).toEqual({
      status: "skipped",
      reason: "already_sponsored",
    });
    expect(second.algo.status).toBe("sent");
    expect(second.algo.txHash).toBe("algotx-2");
  });

  it("does not pay again after the balance is swept", async () => {
    const ledger = createMemorySponsorLedger();
    const chain = mockChain();
    const first = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      chain,
      ledger
    );
    expect(first.eth.status).toBe("sent");
    expect(first.algo.status).toBe("sent");

    const swept = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      mockChain(),
      ledger
    );
    expect(swept.eth.reason).toBe("already_sponsored");
    expect(swept.algo.reason).toBe("already_sponsored");
  });

  it("does not pay a second embedded wallet on the same user", async () => {
    const ledger = createMemorySponsorLedger();
    await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      mockChain(),
      ledger
    );
    let sends = 0;
    const chain = mockChain({
      sendEth: async () => {
        sends += 1;
        return "0xagain";
      },
      sendAlgo: async () => {
        sends += 1;
        return "again";
      },
    });
    const second = await runSponsorJob(
      env,
      { evmAddress: ADDR_B, userId: "user-1" },
      chain,
      ledger
    );
    expect(second.eth.reason).toBe("already_sponsored");
    expect(second.algo.reason).toBe("already_sponsored");
    expect(second.algorandAddress).not.toBe(
      "ALGORANDADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    expect(sends).toBe(0);
  });

  it("shares the drip record across ledger instances", async () => {
    const box = createLedgerBox();
    const first = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      mockChain(),
      createMemorySponsorLedger(box)
    );
    expect(first.eth.status).toBe("sent");
    const restarted = await runSponsorJob(
      env,
      { evmAddress: ADDR, userId: "user-1" },
      mockChain(),
      createMemorySponsorLedger(box)
    );
    expect(restarted.eth.reason).toBe("already_sponsored");
    expect(restarted.algo.reason).toBe("already_sponsored");
  });
});

describe("assertWalletOwnedByUser", () => {
  it("accepts a checksum-equal owned address", () => {
    expect(() =>
      assertWalletOwnedByUser("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", [
        "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
      ])
    ).not.toThrow();
  });

  it("rejects an address the user does not own", () => {
    expect(() =>
      assertWalletOwnedByUser("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", [
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ])
    ).toThrow(AuthError);
  });
});

function request(body: unknown): IncomingMessage {
  const req = Readable.from([
    Buffer.from(typeof body === "string" ? body : JSON.stringify(body)),
  ]) as IncomingMessage;
  req.method = "POST";
  req.headers = { authorization: "Bearer test" };
  return req;
}

function responseSink(): {
  res: ServerResponse;
  done: () => { status: number; body: Record<string, unknown> | null };
} {
  let raw = "";
  const res = {
    statusCode: 0,
    setHeader() {},
    end(payload?: string) {
      raw = payload ?? "";
    },
  };
  return {
    res: res as unknown as ServerResponse,
    done() {
      return {
        status: res.statusCode,
        body: raw ? (JSON.parse(raw) as Record<string, unknown>) : null,
      };
    },
  };
}

async function post(
  env: SponsorEnv,
  deps: SponsorHandlerDeps,
  body: unknown = { evmAddress: ADDR }
) {
  const sink = responseSink();
  await handleSponsor(request(body), sink.res, env, deps);
  return sink.done();
}

describe("handleSponsor", () => {
  const env = liveEnv();

  function deps(
    overrides: SponsorHandlerDeps = {}
  ): SponsorHandlerDeps & { chain: SponsorChain; sends: { eth: number; algo: number } } {
    const sends = { eth: 0, algo: 0 };
    const chain = mockChain({
      sendEth: async () => {
        sends.eth += 1;
        return "0xeth";
      },
      sendAlgo: async () => {
        sends.algo += 1;
        return "algotx";
      },
    });
    return {
      chain,
      sends,
      ledger: createMemorySponsorLedger(),
      authenticate: async () => ({ userId: "user-1" }),
      walletsForUser: async () => [ADDR],
      rateLimit: createRateLimiter({ max: 5, windowMs: 60_000 }),
      ...overrides,
    };
  }

  it("rejects a request with no Privy token", async () => {
    const harness = deps({
      authenticate: async () => {
        throw new AuthError(401, "Missing session");
      },
    });
    const res = await post(env, harness);
    expect(res.status).toBe(401);
    expect(harness.sends.eth).toBe(0);
    expect(harness.sends.algo).toBe(0);
  });

  it("rejects an address the user does not own", async () => {
    const harness = deps({
      walletsForUser: async () => [ADDR_B],
    });
    const res = await post(env, harness);
    expect(res.status).toBe(403);
    expect(harness.sends.eth).toBe(0);
  });

  it("sends nothing when sponsor is disabled", async () => {
    const harness = deps();
    const res = await post(loadSponsorEnv({}), harness);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      eth: { status: "skipped", reason: "disabled" },
      algo: { status: "skipped", reason: "disabled" },
    });
    expect(harness.sends.eth).toBe(0);
    expect(harness.sends.algo).toBe(0);
  });

  it("sends nothing when the ledger is not configured", async () => {
    const harness = deps();
    delete harness.ledger;
    const res = await post(env, harness);
    expect(res.status).toBe(503);
    expect(harness.sends.eth).toBe(0);
    expect(harness.sends.algo).toBe(0);
  });

  it("sends nothing when the ledger cannot be read", async () => {
    const harness = deps({
      ledger: {
        inspect: async () => {
          throw new SponsorLedgerError("down");
        },
        reserve: async () => {
          throw new Error("should not reserve");
        },
        commit: async () => {},
        release: async () => {},
      },
    });
    const res = await post(env, harness);
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: "Sponsor is unavailable" });
    expect(harness.sends.eth).toBe(0);
    expect(harness.sends.algo).toBe(0);
  });

  it("returns 429 on the sixth request inside a minute", async () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 60_000 });
    const harness = deps({ rateLimit: limiter });
    for (let i = 0; i < 5; i += 1) {
      const res = await post(loadSponsorEnv({}), harness);
      expect(res.status).toBe(200);
    }
    const sixth = await post(env, harness);
    expect(sixth.status).toBe(429);
    expect(harness.sends.eth).toBe(0);
  });

  it("stops sending once the daily drip count is spent", async () => {
    const ledger = createMemorySponsorLedger();
    const capped = liveEnv({ SPONSOR_DAILY_MAX_DRIPS: "1" });
    const first = deps({
      ledger,
      authenticate: async () => ({ userId: "user-1" }),
    });
    const opened = await post(capped, first);
    expect(opened.status).toBe(200);
    expect(first.sends.eth).toBe(1);
    expect(first.sends.algo).toBe(1);

    const second = deps({
      ledger,
      authenticate: async () => ({ userId: "user-2" }),
      walletsForUser: async () => [ADDR_B],
    });
    const blocked = await post(capped, second, { evmAddress: ADDR_B });
    expect(blocked.status).toBe(200);
    expect(blocked.body).toMatchObject({
      eth: { status: "skipped", reason: "daily_budget" },
      algo: { status: "skipped", reason: "daily_budget" },
    });
    expect(second.sends.eth).toBe(0);
    expect(second.sends.algo).toBe(0);
  });

  it("stops the leg that would exceed the daily amount", async () => {
    const ledger = createMemorySponsorLedger();
    const capped = liveEnv({
      SPONSOR_DAILY_MAX_DRIPS: "10",
      SPONSOR_DAILY_MAX_ALGO_MICRO: "1000000",
    });
    const first = deps({ ledger });
    await post(capped, first);

    const second = deps({
      ledger,
      authenticate: async () => ({ userId: "user-2" }),
      walletsForUser: async () => [ADDR_B],
    });
    const blocked = await post(capped, second, { evmAddress: ADDR_B });
    expect(blocked.body).toMatchObject({
      eth: { status: "sent" },
      algo: { status: "skipped", reason: "daily_budget" },
    });
    expect(second.sends.eth).toBe(1);
    expect(second.sends.algo).toBe(0);
  });
});

describe("withInflightLock", () => {
  it("coalesces concurrent work for the same key", async () => {
    let runs = 0;
    const job = () =>
      withInflightLock("same", async () => {
        runs += 1;
        await new Promise((r) => setTimeout(r, 20));
        return runs;
      });
    const [a, b] = await Promise.all([job(), job()]);
    expect(runs).toBe(1);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});
