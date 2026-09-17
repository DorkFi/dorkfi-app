import { describe, expect, it } from "vitest";
import {
  isSponsorConfigured,
  isSponsorLive,
  loadSponsorEnv,
  parseAlgoMnemonic,
  parseBoolFlag,
  parseEthPrivateKey,
  parsePositiveBigInt,
} from "../env";
import { assertWalletOwnedByUser, collectWalletAddresses } from "../privyWallets";
import { AuthError } from "../../offramp/privyAuth";
import { createRateLimiter, withInflightLock } from "../rateLimit";
import { spendableAlgoMicroAlgosFromAccount } from "../spendable";
import { runSponsorJob, type SponsorResult } from "../handlers";
import type { SponsorChain } from "../chain";

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
  });

  it("is live only when enabled and keys are present", () => {
    const env = loadSponsorEnv({
      SPONSOR_ENABLED: "true",
      PRIVY_APP_SECRET: "secret",
      SPONSOR_ETH_PRIVATE_KEY: VALID_KEY,
      SPONSOR_ALGO_MNEMONIC: MNEMONIC,
    });
    expect(isSponsorConfigured(env)).toBe(true);
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
    deriveAlgorandAddress: async () => "ALGORANDADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    fetchEthBalanceWei: async () => 0n,
    fetchAlgoSpendableMicro: async () => 0n,
    sendEth: async () => "0xeth",
    sendAlgo: async () => "algotx",
    ...overrides,
  };
}

describe("runSponsorJob", () => {
  const env = loadSponsorEnv({
    SPONSOR_ENABLED: "true",
    PRIVY_APP_SECRET: "secret",
    SPONSOR_ETH_PRIVATE_KEY: VALID_KEY,
    SPONSOR_ALGO_MNEMONIC: MNEMONIC,
  });

  it("sends both when balances are short", async () => {
    const result: SponsorResult = await runSponsorJob(
      env,
      { evmAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      mockChain()
    );
    expect(result.eth.status).toBe("sent");
    expect(result.eth.txHash).toBe("0xeth");
    expect(result.algo.status).toBe("sent");
    expect(result.algo.txHash).toBe("algotx");
    expect(result.algorandAddress).toBeTruthy();
  });

  it("skips when already funded", async () => {
    const result = await runSponsorJob(
      env,
      { evmAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      mockChain({
        fetchEthBalanceWei: async () => 50_000_000_000_000n,
        fetchAlgoSpendableMicro: async () => 100_000n,
      })
    );
    expect(result.eth).toEqual({ status: "skipped", reason: "already_funded" });
    expect(result.algo).toEqual({ status: "skipped", reason: "already_funded" });
  });

  it("records a send error without throwing", async () => {
    const result = await runSponsorJob(
      env,
      { evmAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      mockChain({
        sendEth: async () => {
          throw new Error("rpc down");
        },
        fetchAlgoSpendableMicro: async () => 1_000_000n,
      })
    );
    expect(result.eth.status).toBe("error");
    expect(result.algo.status).toBe("skipped");
  });

  it("can send ETH even if ALGO fails", async () => {
    const result = await runSponsorJob(
      env,
      { evmAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      mockChain({
        sendAlgo: async () => {
          throw new Error("algod down");
        },
      })
    );
    expect(result.eth.status).toBe("sent");
    expect(result.algo.status).toBe("error");
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
