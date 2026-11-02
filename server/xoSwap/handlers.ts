/**
 * Node proxy for Exodus XO Swap V3 (Base ↔ Algorand USDC).
 * Keeps App-Name / API credentials server-side and avoids browser geo blocks
 * on /pairs, /rates, and /orders when the API host is unrestricted.
 *
 * Env (server-only, never VITE_*):
 *   XO_SWAP_APP_NAME     — required App-Name header (partner id)
 *   XO_SWAP_APP_VERSION  — optional (default 1.0.0)
 *   XO_SWAP_API_KEY      — optional Bearer token if Exodus issues one
 *   XO_SWAP_API_BASE     — optional override (default https://exchange.exodus.io)
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { endUserIp } from "../offramp/clientIp.ts";

const DEFAULT_XO_API_BASE = "https://exchange.exodus.io";
/** Exodus rate/order calls. A hung upstream must not leave Deposit to Earn spinning. */
const XO_UPSTREAM_TIMEOUT_MS = 20_000;

export type XoSwapEnv = {
  appName?: string;
  appVersion: string;
  apiKey?: string;
  apiBase: string;
};

export function loadXoSwapEnv(
  env: Record<string, string | undefined> = process.env
): XoSwapEnv {
  return {
    appName: env.XO_SWAP_APP_NAME?.trim() || undefined,
    appVersion: env.XO_SWAP_APP_VERSION?.trim() || "1.0.0",
    apiKey: env.XO_SWAP_API_KEY?.trim() || undefined,
    apiBase: (env.XO_SWAP_API_BASE?.trim() || DEFAULT_XO_API_BASE).replace(
      /\/+$/,
      ""
    ),
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
  body: unknown
): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

function isNonPublicIp(ip: string): boolean {
  const value = ip.toLowerCase();
  if (
    value === "localhost" ||
    value === "::" ||
    value === "::1" ||
    value === "0.0.0.0"
  ) {
    return true;
  }
  if (value.startsWith("127.") || value.startsWith("10.")) return true;
  if (value.startsWith("192.168.") || value.startsWith("169.254.")) return true;
  const rfc1918 = /^172\.(\d{1,3})\./.exec(value);
  if (rfc1918) {
    const second = Number(rfc1918[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) {
    return true;
  }
  return false;
}

/**
 * RFC 7239 Forwarded value. IPv6 must be quoted or Exodus ignores the header
 * and geo-checks the server instead of the visitor.
 * Returns undefined for loopback and private addresses.
 */
export function forwardedHeaderForIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  let value = ip.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1).trim();
  }
  value = value.replace(/^::ffff:/i, "");
  if (!value || isNonPublicIp(value)) return undefined;
  if (value.includes(":")) return `for="[${value}]"`;
  return `for=${value}`;
}

/** Visitor IP from the edge (cf-connecting-ip / x-real-ip), not X-Forwarded-For. */
export function xoClientForwardedHeader(req: IncomingMessage): string | undefined {
  return forwardedHeaderForIp(endUserIp(req));
}

function xoHeaders(
  env: XoSwapEnv,
  req?: IncomingMessage
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "App-Name": env.appName || "dorkfi",
    "App-Version": env.appVersion,
  };
  if (env.apiKey) {
    headers.Authorization = `Bearer ${env.apiKey}`;
  }
  const forwarded = req ? xoClientForwardedHeader(req) : undefined;
  if (forwarded) {
    headers.Forwarded = forwarded;
  }
  return headers;
}

function isUpstreamTimeout(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String((err as { name: unknown }).name) : "";
  const message = err instanceof Error ? err.message : "";
  return name === "TimeoutError" || /timeout/i.test(message);
}

async function proxyXo(
  env: XoSwapEnv,
  req: IncomingMessage,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const url = `${env.apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: xoHeaders(env, req),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(XO_UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    if (isUpstreamTimeout(err)) {
      return {
        status: 504,
        data: { error: "The USDC move timed out. Try again." },
      };
    }
    throw err;
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { error: text.slice(0, 500) };
    }
  }
  return { status: res.status, data };
}

function pathAfterPrefix(url: string, prefix: string): string {
  const q = url.indexOf("?");
  const pathOnly = q >= 0 ? url.slice(0, q) : url;
  const query = q >= 0 ? url.slice(q) : "";
  const rest = pathOnly.slice(prefix.length) || "/";
  return rest + query;
}

/**
 * Route `/api/xo-swap/*`. Returns true when handled.
 */
export async function routeXoSwapRequest(
  req: IncomingMessage,
  res: ServerResponse,
  env: XoSwapEnv,
  url: string
): Promise<boolean> {
  const method = (req.method || "GET").toUpperCase();
  const path = pathAfterPrefix(url, "/api/xo-swap");

  if (method === "GET" && (path === "/health" || path.startsWith("/health?"))) {
    sendJson(res, 200, {
      ok: Boolean(env.appName),
      configured: Boolean(env.appName),
      appName: env.appName ? true : false,
    });
    return true;
  }

  if (!env.appName) {
    sendJson(res, 503, {
      error:
        "XO Swap is not configured. Set XO_SWAP_APP_NAME (Exodus partner App-Name).",
    });
    return true;
  }

  try {
    // GET /pair/:pairId
    let m = path.match(/^\/pair\/([^/?]+)\/?(\?.*)?$/);
    if (method === "GET" && m && !path.includes("/rates") && !path.includes("/quotes")) {
      const pairId = decodeURIComponent(m[1]!);
      const { status, data } = await proxyXo(
        env,
        req,
        "GET",
        `/v3/pairs/${encodeURIComponent(pairId)}`
      );
      sendJson(res, status, data);
      return true;
    }

    // GET /pair/:pairId/rates
    m = path.match(/^\/pair\/([^/]+)\/rates\/?(\?.*)?$/);
    if (method === "GET" && m) {
      const pairId = decodeURIComponent(m[1]!);
      const { status, data } = await proxyXo(
        env,
        req,
        "GET",
        `/v3/pairs/${encodeURIComponent(pairId)}/rates`
      );
      sendJson(res, status, data);
      return true;
    }

    // GET /pair/:pairId/quotes?amount=
    m = path.match(/^\/pair\/([^/]+)\/quotes\/?(\?.*)?$/);
    if (method === "GET" && m) {
      const pairId = decodeURIComponent(m[1]!);
      const query = m[2] || "";
      const { status, data } = await proxyXo(
        env,
        req,
        "GET",
        `/v3/pairs/${encodeURIComponent(pairId)}/quotes${query}`
      );
      sendJson(res, status, data);
      return true;
    }

    // GET /orders/:orderId
    m = path.match(/^\/orders\/([^/?]+)\/?(\?.*)?$/);
    if (method === "GET" && m) {
      const orderId = decodeURIComponent(m[1]!);
      const { status, data } = await proxyXo(
        env,
        req,
        "GET",
        `/v3/orders/${encodeURIComponent(orderId)}`
      );
      sendJson(res, status, data);
      return true;
    }

    // PATCH /orders/:orderId
    m = path.match(/^\/orders\/([^/?]+)\/?$/);
    if (method === "PATCH" && m) {
      const orderId = decodeURIComponent(m[1]!);
      const body = await readJsonBody(req);
      const { status, data } = await proxyXo(
        env,
        req,
        "PATCH",
        `/v3/orders/${encodeURIComponent(orderId)}`,
        body
      );
      sendJson(res, status, data);
      return true;
    }

    // POST /orders  (fixed) | POST /orders/float
    if (method === "POST" && (path === "/orders" || path.startsWith("/orders?"))) {
      const body = await readJsonBody(req);
      const { status, data } = await proxyXo(env, req, "POST", "/v3/orders", body);
      sendJson(res, status, data);
      return true;
    }
    if (
      method === "POST" &&
      (path === "/orders/float" || path.startsWith("/orders/float?"))
    ) {
      const body = await readJsonBody(req);
      const { status, data } = await proxyXo(
        env,
        req,
        "POST",
        "/v3/orders/float",
        body
      );
      sendJson(res, status, data);
      return true;
    }

    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 502, { error: message });
    return true;
  }
}
