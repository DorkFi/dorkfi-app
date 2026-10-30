/**
 * Easy Start gas sponsor: dust ETH on Base + ALGO on the derived xChain address.
 *
 * Env (server-only, never VITE_):
 *   SPONSOR_ENABLED=true
 *   PRIVY_APP_SECRET
 *   SPONSOR_ETH_PRIVATE_KEY
 *   SPONSOR_ALGO_MNEMONIC
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
import { createRateLimiter, withInflightLock } from "./rateLimit.ts";

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

export async function runSponsorJob(
  env: SponsorEnv,
  input: { evmAddress: string },
  chain: SponsorChain
): Promise<SponsorResult> {
  const evmAddress = getAddress(input.evmAddress);
  const result: SponsorResult = {
    evmAddress,
    algorandAddress: null,
    eth: { status: "skipped", reason: "already_funded" },
    algo: { status: "skipped", reason: "already_funded" },
  };

  const algorandAddress = await chain.deriveAlgorandAddress(evmAddress);
  result.algorandAddress = algorandAddress;

  const [ethBal, algoSpendable] = await Promise.all([
    chain.fetchEthBalanceWei(evmAddress),
    chain.fetchAlgoSpendableMicro(algorandAddress),
  ]);

  if (ethBal < MIN_BASE_ETH_WEI) {
    try {
      const txHash = await chain.sendEth(evmAddress, env.ethAmountWei);
      result.eth = { status: "sent", txHash };
    } catch (error) {
      console.error("[sponsor] ETH send failed", {
        evmAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      result.eth = {
        status: "error",
        error: "Could not send ETH",
      };
    }
  }

  if (algoSpendable < MIN_ALGORAND_ALGO_MICRO) {
    try {
      const txHash = await chain.sendAlgo(algorandAddress, env.algoMicro);
      result.algo = { status: "sent", txHash };
    } catch (error) {
      console.error("[sponsor] ALGO send failed", {
        algorandAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      result.algo = {
        status: "error",
        error: sponsorSendErrorMessage(error, "Could not send ALGO"),
      };
    }
  }

  return result;
}

export async function handleSponsor(
  req: IncomingMessage,
  res: ServerResponse,
  env: SponsorEnv,
  chain: SponsorChain = createSponsorChain(env)
): Promise<void> {
  try {
    const { userId } = await requirePrivyAuth(req, env.privyAppId);

    if (!userRateLimit.allow(userId)) {
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

    const owned = await fetchPrivyWalletAddresses({
      userId,
      privyAppId: env.privyAppId,
      privyAppSecret: env.privyAppSecret,
    });
    assertWalletOwnedByUser(evmAddress, owned);

    const result = await withInflightLock(evmAddress, () =>
      runSponsorJob(env, { evmAddress }, chain)
    );
    sendJson(res, 200, result);
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
    console.error("[sponsor] request failed", message);
    sendJson(res, 500, { error: "Sponsor request failed" });
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
  return Promise.resolve(false);
}

export { loadSponsorEnv, isSponsorLive, isSponsorConfigured };
