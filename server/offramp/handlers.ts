/**
 * Node handlers for Easy Start off-ramp (Coinbase CDP + MoonPay URL signing).
 * Used by the Vite dev plugin; the same logic can be mounted on a production API.
 *
 * Env (server-only, never VITE_*):
 *   CDP_API_KEY_ID / CDP_API_KEY_SECRET  (or COINBASE_CDP_API_KEY_ID / COINBASE_CDP_API_KEY_SECRET)
 *   MOONPAY_SECRET_KEY
 */
import { createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const CDP_HOST = "api.developer.coinbase.com";

export type OfframpEnv = {
  cdpApiKeyId?: string;
  cdpApiKeySecret?: string;
  moonpaySecretKey?: string;
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

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]!.trim();
  }
  return req.socket.remoteAddress?.replace(/^::ffff:/, "") || "127.0.0.1";
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
      clientIp?: string;
      partnerUserRef?: string;
      redirectUrl?: string;
      amount?: string | number;
    };
    const address = body.address?.trim();
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      sendJson(res, 400, { error: "Valid Base wallet address required" });
      return;
    }

    const path = "/onramp/v1/token";
    const jwt = await cdpBearer(env, "POST", path);
    const ip = body.clientIp?.trim() || clientIp(req);

    const upstream = await fetch(`https://${CDP_HOST}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addresses: [{ address, blockchains: ["base"] }],
        clientIp: ip,
        assets: ["USDC"],
      }),
    });

    const data = (await upstream.json()) as {
      token?: string;
      error?: string;
      message?: string;
    };
    if (!upstream.ok || !data.token) {
      sendJson(res, upstream.status || 502, {
        error:
          data.error ||
          data.message ||
          `Coinbase session failed (${upstream.status})`,
      });
      return;
    }

    const partnerUserRef = (
      body.partnerUserRef ||
      `df-${address.slice(2, 10)}-${Date.now().toString(36)}`
    ).slice(0, 50);
    const redirectUrl =
      body.redirectUrl || "http://localhost:8080/portfolio";

    const sellUrl = new URL("https://pay.coinbase.com/v3/sell/input");
    sellUrl.searchParams.set("sessionToken", data.token);
    sellUrl.searchParams.set("partnerUserRef", partnerUserRef);
    sellUrl.searchParams.set("redirectUrl", redirectUrl);
    sellUrl.searchParams.set("defaultNetwork", "base");
    sellUrl.searchParams.set("defaultAsset", "USDC");
    if (body.amount != null && Number(body.amount) > 0) {
      sellUrl.searchParams.set("presetCryptoAmount", String(body.amount));
    }

    sendJson(res, 200, {
      sessionToken: data.token,
      partnerUserRef,
      sellUrl: sellUrl.toString(),
    });
  } catch (e: unknown) {
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
    const ref = decodeURIComponent(partnerUserRef).trim();
    if (!ref) {
      sendJson(res, 400, { error: "partnerUserRef required" });
      return;
    }
    const path = `/onramp/v1/sell/user/${encodeURIComponent(ref)}/transactions`;
    const jwt = await cdpBearer(env, "GET", path);
    const url = new URL(`https://${CDP_HOST}${path}`);
    url.searchParams.set("pageSize", "5");

    const upstream = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const data = (await upstream.json()) as Record<string, unknown>;
    if (!upstream.ok) {
      sendJson(res, upstream.status || 502, {
        error:
          (data.error as string) ||
          (data.message as string) ||
          `Status fetch failed (${upstream.status})`,
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
