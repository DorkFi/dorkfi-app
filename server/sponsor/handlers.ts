/**
 * Easy Start gas sponsor: dust ETH on Base + ALGO on the derived xChain address.
 *
 * Env (server-only, never VITE_):
 *   SPONSOR_ENABLED=true
 *   PRIVY_APP_SECRET
 *   SPONSOR_ETH_PRIVATE_KEY
 *   SPONSOR_ALGO_MNEMONIC
 *   SPONSOR_REDIS_URL
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { getAddress } from "viem";
import { AuthError, requirePrivyAuth } from "../offramp/privyAuth.ts";
import {
  createSponsorChain,
  type SponsorChain,
} from "./chain.ts";
import {
  isSponsorConfigured,
  isSponsorLive,
  loadSponsorEnv,
  MIN_ALGORAND_ALGO_MICRO,
  MIN_BASE_ETH_WEI,
  type SponsorEnv,
} from "./env.ts";
import { sponsorSendErrorMessage } from "./spendable.ts";
import {
  assertWalletOwnedByUser,
  fetchPrivyWalletAddresses,
} from "./privyWallets.ts";
import { createRateLimiter, withInflightLock, type RateLimiter } from "./rateLimit.ts";
import {
  ledgerForEnv,
  SponsorLedgerError,
  type LegName,
  type SponsorLedger,
} from "./ledger.ts";
import {
  deletePendingEarnDepositJob,
  getPendingEarnDepositJob,
  setPendingEarnDepositJob,
} from "./pendingDepositStore.ts";

export type SponsorLegStatus = "sent" | "skipped" | "error";

export type SponsorLeg = {
  status: SponsorLegStatus;
  txHash?: string;
  reason?: string;
  error?: string;
};

export type SponsorResult = {
  evmAddress: string;
  algorandAddress: string | null;
  eth: SponsorLeg;
  algo: SponsorLeg;
};

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>
): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

function parseEvmAddress(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new AuthError(400, "Valid Base wallet address required");
  }
  try {
    return getAddress(raw.trim());
  } catch {
    throw new AuthError(400, "Valid Base wallet address required");
  }
}

const userRateLimit = createRateLimiter({ max: 5, windowMs: 60_000 });
const pendingDepositRateLimit = createRateLimiter({ max: 30, windowMs: 60_000 });

export type SponsorHandlerDeps = {
  chain?: SponsorChain;
  ledger?: SponsorLedger;
  authenticate?: (
    req: IncomingMessage
  ) => Promise<{ userId: string }>;
  walletsForUser?: (userId: string) => Promise<string[]>;
  rateLimit?: RateLimiter;
};

async function sendLeg(args: {
  env: SponsorEnv;
  ledger: SponsorLedger;
  chain: SponsorChain;
  userId: string;
  evmAddress: string;
  algorandAddress: string;
  leg: LegName;
  reservationId: string;
}): Promise<SponsorLeg> {
  const amount = args.leg === "eth" ? args.env.ethAmountWei : args.env.algoMicro;
  let txHash: string | undefined;
  try {
    txHash =
      args.leg === "eth"
        ? await args.chain.sendEth(args.evmAddress, amount)
        : await args.chain.sendAlgo(args.algorandAddress, amount);
    await args.ledger.commit(args.reservationId, txHash);
    console.info("[sponsor] sent", {
      leg: args.leg,
      userId: args.userId,
      evmAddress: args.evmAddress,
      algorandAddress: args.algorandAddress,
      txHash,
      amount: amount.toString(),
    });
    return { status: "sent", txHash };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!txHash) {
      try {
        await args.ledger.release(args.reservationId);
      } catch (releaseError) {
        console.error("[sponsor] release failed", {
          leg: args.leg,
          userId: args.userId,
          error:
            releaseError instanceof Error
              ? releaseError.message
              : String(releaseError),
        });
      }
      console.error(`[sponsor] ${args.leg.toUpperCase()} send failed`, {
        userId: args.userId,
        evmAddress: args.evmAddress,
        algorandAddress: args.algorandAddress,
        error: message,
      });
    } else {
      console.error("[sponsor] commit failed after send", {
        leg: args.leg,
        userId: args.userId,
        txHash,
        error: message,
      });
    }
    return {
      status: "error",
      error:
        args.leg === "eth"
          ? "Could not send ETH"
          : sponsorSendErrorMessage(error, "Could not send ALGO"),
    };
  }
}

export async function runSponsorJob(
  env: SponsorEnv,
  input: { evmAddress: string; userId: string },
  chain: SponsorChain,
  ledger: SponsorLedger
): Promise<SponsorResult> {
  const evmAddress = getAddress(input.evmAddress);
  const userId = input.userId.trim();
  if (!userId) {
    throw new SponsorLedgerError("Sponsor ledger is unavailable");
  }
  const algorandAddress = await chain.deriveAlgorandAddress(evmAddress);
  const result: SponsorResult = {
    evmAddress,
    algorandAddress,
    eth: { status: "skipped", reason: "already_funded" },
    algo: { status: "skipped", reason: "already_funded" },
  };
  const identity = { userId, evmAddress, algorandAddress };
  const inspected = await ledger.inspect(identity);
  const needed: Array<{ leg: LegName; amount: bigint }> = [];

  for (const leg of ["eth", "algo"] as const) {
    const status = inspected[leg];
    if (status === "sent") {
      result[leg] = { status: "skipped", reason: "already_sponsored" };
      continue;
    }
    if (status === "pending") {
      result[leg] = { status: "skipped", reason: "pending" };
      continue;
    }
    const balance =
      leg === "eth"
        ? await chain.fetchEthBalanceWei(evmAddress)
        : await chain.fetchAlgoSpendableMicro(algorandAddress);
    const floor = leg === "eth" ? MIN_BASE_ETH_WEI : MIN_ALGORAND_ALGO_MICRO;
    if (balance >= floor) {
      result[leg] = { status: "skipped", reason: "already_funded" };
      continue;
    }
    needed.push({
      leg,
      amount: leg === "eth" ? env.ethAmountWei : env.algoMicro,
    });
  }

  if (needed.length === 0) return result;

  const reserved = await ledger.reserve({
    ...identity,
    legs: needed,
    limits: {
      maxDrips: env.dailyMaxDrips,
      maxEthWei: env.dailyMaxEthWei,
      maxAlgoMicro: env.dailyMaxAlgoMicro,
    },
  });

  for (const leg of needed) {
    const decision = reserved[leg.leg];
    if (!decision || decision.status === "skip") {
      result[leg.leg] = {
        status: "skipped",
        reason: decision?.reason ?? "daily_budget",
      };
      continue;
    }
    result[leg.leg] = await sendLeg({
      env,
      ledger,
      chain,
      userId,
      evmAddress,
      algorandAddress,
      leg: leg.leg,
      reservationId: decision.id,
    });
  }

  return result;
}

export async function handleSponsor(
  req: IncomingMessage,
  res: ServerResponse,
  env: SponsorEnv,
  deps: SponsorHandlerDeps = {}
): Promise<void> {
  const chain = deps.chain ?? createSponsorChain(env);
  const authenticate =
    deps.authenticate ??
    ((incoming: IncomingMessage) => requirePrivyAuth(incoming, env.privyAppId));
  const walletsForUser =
    deps.walletsForUser ??
    ((userId: string) =>
      fetchPrivyWalletAddresses({
        userId,
        privyAppId: env.privyAppId,
        privyAppSecret: env.privyAppSecret || "",
      }));
  const rateLimit = deps.rateLimit ?? userRateLimit;

  try {
    const { userId } = await authenticate(req);

    if (!rateLimit.allow(userId)) {
      sendJson(res, 429, { error: "Too many sponsor requests" });
      return;
    }

    const body = (await readJsonBody(req)) as { evmAddress?: unknown };
    const evmAddress = parseEvmAddress(body.evmAddress);

    if (!env.enabled) {
      sendJson(res, 200, {
        evmAddress,
        algorandAddress: null,
        eth: { status: "skipped", reason: "disabled" },
        algo: { status: "skipped", reason: "disabled" },
      } satisfies SponsorResult);
      return;
    }

    if (!isSponsorConfigured(env) || !env.privyAppSecret) {
      sendJson(res, 503, { error: "Sponsor is not configured" });
      return;
    }

    const owned = await walletsForUser(userId);
    assertWalletOwnedByUser(evmAddress, owned);

    const ledger = deps.ledger ?? (env.redisUrl ? ledgerForEnv(env) : null);
    if (!ledger) {
      console.error("[sponsor] refusing to send without SPONSOR_REDIS_URL");
      sendJson(res, 503, { error: "Sponsor is not configured" });
      return;
    }

    const result = await withInflightLock(evmAddress, () =>
      runSponsorJob(env, { evmAddress, userId }, chain, ledger)
    );
    sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof SponsorLedgerError) {
      console.error("[sponsor] ledger refused the send", error.message);
      sendJson(res, 503, { error: "Sponsor is unavailable" });
      return;
    }
    if (error instanceof AuthError) {
      sendJson(res, error.status, { error: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(res, 400, { error: "Invalid JSON" });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sponsor] request failed", message);
    sendJson(res, 500, { error: "Sponsor request failed" });
  }
}

async function handlePendingDeposit(
  req: IncomingMessage,
  res: ServerResponse,
  env: SponsorEnv
): Promise<void> {
  try {
    const { userId } = await requirePrivyAuth(req, env.privyAppId);
    if (!pendingDepositRateLimit.allow(userId)) {
      sendJson(res, 429, { error: "Too many pending deposit requests" });
      return;
    }
    const method = (req.method || "GET").toUpperCase();
    if (method === "GET") {
      sendJson(res, 200, { job: getPendingEarnDepositJob(userId) });
      return;
    }
    if (method === "DELETE") {
      deletePendingEarnDepositJob(userId);
      sendJson(res, 200, { ok: true, job: null });
      return;
    }
    if (method === "PUT") {
      const body = await readJsonBody(req);
      const job = setPendingEarnDepositJob(userId, body);
      if (!job) {
        sendJson(res, 400, { error: "Invalid pending deposit" });
        return;
      }
      sendJson(res, 200, { job });
      return;
    }
    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    if (error instanceof AuthError) {
      sendJson(res, error.status, { error: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(res, 400, { error: "Invalid JSON" });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pending-deposit] request failed", message);
    sendJson(res, 500, { error: "Pending deposit request failed" });
  }
}

export async function handleSponsorHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  env: SponsorEnv
): Promise<void> {
  sendJson(res, 200, {
    ok: true,
    enabled: env.enabled,
    configured: isSponsorConfigured(env),
    live: isSponsorLive(env),
    ledgerConfigured: Boolean(env.redisUrl),
  });
}

export function routeSponsorRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: SponsorEnv,
  urlPath: string
): Promise<boolean> {
  const path = urlPath.split("?")[0] || "";
  if (path === "/api/easy-start/health" && req.method === "GET") {
    return handleSponsorHealth(req, res, env).then(() => true);
  }
  if (path === "/api/easy-start/sponsor" && req.method === "POST") {
    return handleSponsor(req, res, env).then(() => true);
  }
  if (path === "/api/easy-start/pending-deposit") {
    const method = (req.method || "GET").toUpperCase();
    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return Promise.resolve(true);
    }
    return handlePendingDeposit(req, res, env).then(() => true);
  }
  return Promise.resolve(false);
}

export { loadSponsorEnv, isSponsorLive, isSponsorConfigured };
