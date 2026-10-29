/**
 * Node handlers for Easy Start Coinbase Onramp/Offramp + MoonPay URL signing.
 * Used by the Vite dev plugin; the same logic can be mounted on a production API.
 *
 * Env (server-only, never VITE_*):
 *   CDP_API_KEY_ID / CDP_API_KEY_SECRET  (or COINBASE_CDP_API_KEY_ID / COINBASE_CDP_API_KEY_SECRET)
 *   MOONPAY_SECRET_KEY
 *   PRIVY_APP_ID (or VITE_PRIVY_APP_ID) — verifies user JWTs before Coinbase calls
 */
import { createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AuthError, requirePrivyAuth } from "./privyAuth.js";
import {
  buildCoinbaseOfframpSellUrl,
  buildCoinbaseOnrampBuyUrl,
  COINBASE_ALGORAND_ALGO,
  COINBASE_BASE_USDC,
  coinbaseSessionTokenBody,
  parseCoinbaseCashoutMethod,
  type CoinbaseAssetTarget,
  withCoinbaseOfframpReturnQuery,
} from "./coinbaseUrls.ts";
import { assertPrivyOwnsXchainAddress } from "./xchainBind.ts";
import {
  coinbaseClientIp,
  isPrivateOrLoopbackIp,
  partnerUserRefFromUserId,
} from "./clientIp.ts";
import { resolveCoinbaseRedirectUrl } from "./redirectUrl.ts";
import {
  partnerUserRefFromAlgorandAddress,
  verifyAlgorandOnrampProof,
} from "./walletProof.ts";
import { cdpFailureMessage, parseCdpBody } from "./cdpResponse.ts";
import {
  assertWalletOwnedByUser,
  fetchPrivyWalletAddresses,
} from "../sponsor/privyWallets.ts";

const CDP_HOST = "api.developer.coinbase.com";
/** Keep in sync with DEFAULT_PRIVY_APP_ID in src/utils/privyOrigin.ts */
const DEFAULT_PRIVY_APP_ID = "cmrfehwv300ix0ci8uh0tnm8q";

export type OfframpEnv = {
  cdpApiKeyId?: string;
  cdpApiKeySecret?: string;
  moonpaySecretKey?: string;
  privyAppId?: string;
  privyAppSecret?: string;
  redirectUrl?: string;
  /** Public IP to send Coinbase when the request peer is loopback or private. */
  cdpClientIp?: string;
};

export function loadOfframpEnv(
  env: Record<string, string | undefined> = process.env
): OfframpEnv {
  return {
    cdpApiKeyId:
      env.CDP_API_KEY_ID ??
      env.COINBASE_CDP_API_KEY_ID ??
      env.CDP_API_KEY ??
      undefined,
    cdpApiKeySecret:
      env.CDP_API_KEY_SECRET ??
      env.COINBASE_CDP_API_KEY_SECRET ??
      env.CDP_API_SECRET ??
      undefined,
    moonpaySecretKey: env.MOONPAY_SECRET_KEY ?? undefined,
    privyAppId:
      env.PRIVY_APP_ID?.trim() ||
      env.VITE_PRIVY_APP_ID?.trim() ||
      DEFAULT_PRIVY_APP_ID,
    privyAppSecret: env.PRIVY_APP_SECRET?.trim() || undefined,
    redirectUrl:
      env.OFFRAMP_REDIRECT_URL?.trim() ||
      env.VITE_OFFRAMP_REDIRECT_URL?.trim() ||
      undefined,
    cdpClientIp: env.CDP_CLIENT_IP?.trim() || undefined,
  };
}

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

async function ensurePrivyUser(
  req: IncomingMessage,
  res: ServerResponse,
  env: OfframpEnv
): Promise<boolean> {
  try {
    await requirePrivyAuth(req, env.privyAppId);
    return true;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 401;
    const message =
      error instanceof AuthError ? error.message : "Authentication required";
    sendJson(res, status, { error: message });
    return false;
  }
}

async function cdpBearer(
  env: OfframpEnv,
  method: string,
  path: string
): Promise<string> {
  if (!env.cdpApiKeyId || !env.cdpApiKeySecret) {
    throw new Error(
      "Coinbase CDP keys missing. Set CDP_API_KEY_ID and CDP_API_KEY_SECRET."
    );
  }
  const { generateJwt } = await import("@coinbase/cdp-sdk/auth");
  return generateJwt({
    apiKeyId: env.cdpApiKeyId,
    apiKeySecret: env.cdpApiKeySecret,
    requestMethod: method,
    requestHost: CDP_HOST,
    requestPath: path,
    expiresIn: 120,
  });
}

export async function handleCoinbaseSession(
  req: IncomingMessage,
  res: ServerResponse,
  env: OfframpEnv
): Promise<void> {
  try {
    const body = (await readJsonBody(req)) as {
      address?: string;
      redirectUrl?: string;
      amount?: string | number;
      destination?: string;
      cashoutMethod?: string;
      walletProof?: string;
    };
    const wantsAlgo = body.destination === "algorand";
    const walletProof =
      typeof body.walletProof === "string" ? body.walletProof.trim() : "";
    const cashoutMethod = parseCoinbaseCashoutMethod(body.cashoutMethod);
    if (body.cashoutMethod != null && body.cashoutMethod !== "" && !cashoutMethod) {
      sendJson(res, 400, { error: "Unsupported Coinbase cash-out method" });
      return;
    }
    let address = body.address?.trim() ?? "";
    let target: CoinbaseAssetTarget = COINBASE_BASE_USDC;
    let partnerUserRef: string;

    if (walletProof) {
      if (!wantsAlgo) {
        sendJson(res, 400, {
          error: "A signed wallet is only accepted for an Algorand buy",
        });
        return;
      }
      if (cashoutMethod) {
        sendJson(res, 400, {
          error: "Cash out stays on the signed-in Easy Start account",
        });
        return;
      }
      try {
        const proven = verifyAlgorandOnrampProof(walletProof);
        if (address && address !== proven) {
          sendJson(res, 400, {
            error: "Address does not match the signed wallet",
          });
          return;
        }
        address = proven;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid wallet proof";
        sendJson(res, 401, { error: message });
        return;
      }
      target = COINBASE_ALGORAND_ALGO;
      partnerUserRef = partnerUserRefFromAlgorandAddress(address);
    } else {
      const { userId } = await requirePrivyAuth(req, env.privyAppId);
      if (!env.privyAppSecret) {
        sendJson(res, 503, {
          error:
            "PRIVY_APP_SECRET is required to bind Coinbase destinations to the signed-in wallet",
        });
        return;
      }
      const owned = await fetchPrivyWalletAddresses({
        userId,
        privyAppId: env.privyAppId || DEFAULT_PRIVY_APP_ID,
        privyAppSecret: env.privyAppSecret,
      });

      if (wantsAlgo) {
        await assertPrivyOwnsXchainAddress(owned, address);
        target = COINBASE_ALGORAND_ALGO;
      } else {
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
          sendJson(res, 400, { error: "Valid Base wallet address required" });
          return;
        }
        assertWalletOwnedByUser(address, owned);
      }
      partnerUserRef = partnerUserRefFromUserId(userId);
    }

    const path = "/onramp/v1/token";
    const jwt = await cdpBearer(env, "POST", path);
    const ip = await coinbaseClientIp(req, {
      override: env.cdpClientIp,
      allowPublicLookup: process.env.NODE_ENV !== "production",
    });
    if (isPrivateOrLoopbackIp(ip)) {
      sendJson(res, 400, {
        error:
          "Coinbase needs a public IP. This request came from a private address, and the public-IP lookup failed. Set CDP_CLIENT_IP to your public IP and retry.",
      });
      return;
    }

    const upstream = await fetch(`https://${CDP_HOST}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        coinbaseSessionTokenBody({ address, clientIp: ip, target })
      ),
    });

    const data = parseCdpBody(await upstream.text());
    if (!upstream.ok || typeof data.token !== "string" || !data.token) {
      sendJson(res, upstream.status || 502, {
        error: cdpFailureMessage(
          upstream.status || 502,
          data,
          "Coinbase session failed"
        ),
      });
      return;
    }

    const redirectUrl = resolveCoinbaseRedirectUrl(req, body.redirectUrl, {
      OFFRAMP_REDIRECT_URL: env.redirectUrl,
    });

    const widgetArgs = {
      sessionToken: data.token,
      partnerUserRef,
      redirectUrl,
      amount: body.amount,
    };

    sendJson(res, 200, {
      sessionToken: data.token,
      partnerUserRef,
      buyUrl: buildCoinbaseOnrampBuyUrl(widgetArgs, target),
      sellUrl: buildCoinbaseOfframpSellUrl(
        {
          ...widgetArgs,
          redirectUrl: withCoinbaseOfframpReturnQuery(
            redirectUrl,
            partnerUserRef
          ),
        },
        cashoutMethod && wantsAlgo ? COINBASE_ALGORAND_ALGO : COINBASE_BASE_USDC,
        cashoutMethod
      ),
    });
  } catch (e: unknown) {
    if (e instanceof AuthError) {
      sendJson(res, e.status, { error: e.message });
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    sendJson(res, 500, { error: message });
  }
}

export async function handleCoinbaseStatus(
  req: IncomingMessage,
  res: ServerResponse,
  env: OfframpEnv,
  partnerUserRef: string
): Promise<void> {
  try {
    if (!(await ensurePrivyUser(req, res, env))) return;
    const ref = decodeURIComponent(partnerUserRef).trim();
    if (!ref) {
      sendJson(res, 400, { error: "partnerUserRef required" });
      return;
    }
    const path = `/onramp/v1/sell/user/${encodeURIComponent(ref)}/transactions`;
    const jwt = await cdpBearer(env, "GET", path);
    const url = new URL(`https://${CDP_HOST}${path}`);
    url.searchParams.set("page_size", "5");

    const upstream = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const data = parseCdpBody(await upstream.text());
    if (!upstream.ok) {
      sendJson(res, upstream.status || 502, {
        error: cdpFailureMessage(
          upstream.status || 502,
          data,
          "Status fetch failed"
        ),
        raw: data,
      });
      return;
    }

    const transactions = (data.transactions ??
      data.sells ??
      []) as Array<Record<string, unknown>>;
    const latest = transactions[0] ?? null;
    sendJson(res, 200, { transactions, latest });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    sendJson(res, 500, { error: message });
  }
}

export async function handleMoonpaySign(
  req: IncomingMessage,
  res: ServerResponse,
  env: OfframpEnv
): Promise<void> {
  try {
    if (!(await ensurePrivyUser(req, res, env))) return;
    if (!env.moonpaySecretKey) {
      sendJson(res, 503, {
        error: "MoonPay secret missing. Set MOONPAY_SECRET_KEY.",
      });
      return;
    }
    const body = (await readJsonBody(req)) as { url?: string };
    const url = body.url?.trim();
    if (!url) {
      sendJson(res, 400, { error: "url required" });
      return;
    }
    const query = new URL(url).search;
    const signature = createHmac("sha256", env.moonpaySecretKey)
      .update(query)
      .digest("base64");
    sendJson(res, 200, { signature });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    sendJson(res, 500, { error: message });
  }
}

export async function handleOfframpHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  env: OfframpEnv
): Promise<void> {
  sendJson(res, 200, {
    ok: true,
    coinbase: Boolean(env.cdpApiKeyId && env.cdpApiKeySecret),
    moonpay: Boolean(env.moonpaySecretKey),
    walletBind: Boolean(env.privyAppSecret),
  });
}

/** Route `/api/offramp/*` requests. Returns true if handled. */
export async function routeOfframpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: OfframpEnv,
  urlPath: string
): Promise<boolean> {
  const path = urlPath.split("?")[0] || "";
  if (path === "/api/offramp/health" && req.method === "GET") {
    await handleOfframpHealth(req, res, env);
    return true;
  }
  if (path === "/api/offramp/coinbase/session" && req.method === "POST") {
    await handleCoinbaseSession(req, res, env);
    return true;
  }
  if (path === "/api/offramp/moonpay/sign" && req.method === "POST") {
    await handleMoonpaySign(req, res, env);
    return true;
  }
  const statusMatch = path.match(
    /^\/api\/offramp\/coinbase\/status\/([^/]+)$/
  );
  if (statusMatch && req.method === "GET") {
    await handleCoinbaseStatus(req, res, env, statusMatch[1]!);
    return true;
  }
  return false;
}
