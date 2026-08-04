#!/usr/bin/env node
/**
 * Standalone Haystack Order Router proxy.
 * Keeps HAYSTACK_API_KEY on the server — never expose it via VITE_*.
 *
 * Local:
 *   HAYSTACK_API_KEY=… npm run haystack-proxy
 *   # http://127.0.0.1:8791 — CORS defaults to local Vite origins
 *
 * Beta / production (separate host from the static SPA):
 *   HAYSTACK_API_KEY=…
 *   HAYSTACK_PROXY_HOST=0.0.0.0
 *   HAYSTACK_PROXY_CORS_ORIGINS=https://beta.dork.fi,https://app.dork.fi
 *   npm run haystack-proxy
 *
 * Point the SPA build at this process with:
 *   VITE_HAYSTACK_PROXY_URL=https://your-proxy.example.com
 *   VITE_ENABLE_CROSS_ASSET_REPAY=true
 *
 * Env:
 *   HAYSTACK_API_KEY            (required)
 *   HAYSTACK_PROXY_PORT         (default 8791; also accepts platform `PORT`)
 *   HAYSTACK_PROXY_HOST         (default 127.0.0.1; use 0.0.0.0 to bind publicly)
 *   HAYSTACK_PROXY_CORS_ORIGINS (comma-separated; required when host is not loopback)
 *   HAYSTACK_API_BASE           (default https://hayrouter.txnlab.dev)
 *   HAYSTACK_PROXY_UPSTREAM_TIMEOUT_MS (default 20000 — cap hung hayrouter calls)
 */

import http from "node:http";
import { URL } from "node:url";

const API_KEY = process.env.HAYSTACK_API_KEY?.trim();
const PORT = Number(
  process.env.HAYSTACK_PROXY_PORT || process.env.PORT || 8791
);
const HOST = (process.env.HAYSTACK_PROXY_HOST || "127.0.0.1").trim();
const UPSTREAM = (
  process.env.HAYSTACK_API_BASE || "https://hayrouter.txnlab.dev"
).replace(/\/$/, "");
const UPSTREAM_TIMEOUT_MS = Number(
  process.env.HAYSTACK_PROXY_UPSTREAM_TIMEOUT_MS || 20_000
);

const LOCAL_DEV_ORIGINS = [
  "http://127.0.0.1:8080",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

function isLoopbackHost(host) {
  return (
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]"
  );
}

function parseCorsOrigins(raw) {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const CORS_ORIGINS = parseCorsOrigins(process.env.HAYSTACK_PROXY_CORS_ORIGINS);
const EFFECTIVE_CORS = CORS_ORIGINS.length
  ? CORS_ORIGINS
  : isLoopbackHost(HOST)
    ? LOCAL_DEV_ORIGINS
    : [];

if (!API_KEY) {
  console.error("HAYSTACK_API_KEY is required");
  process.exit(1);
}

if (!isLoopbackHost(HOST) && EFFECTIVE_CORS.length === 0) {
  console.error(
    "HAYSTACK_PROXY_CORS_ORIGINS is required when HAYSTACK_PROXY_HOST is not loopback.\n" +
      "Example: HAYSTACK_PROXY_CORS_ORIGINS=https://beta.dork.fi,https://app.dork.fi"
  );
  process.exit(1);
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @returns {boolean} true if the request may proceed
 */
function applyCors(req, res) {
  const origin = req.headers.origin;
  // Non-browser clients (curl, health checks) omit Origin.
  if (!origin) {
    return true;
  }
  const normalized = origin.replace(/\/$/, "");
  if (!EFFECTIVE_CORS.includes(normalized)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Origin not allowed" }));
    return false;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return true;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

function upstreamAbortSignal() {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), UPSTREAM_TIMEOUT_MS);
  return c.signal;
}

/**
 * @param {string} label
 * @param {string} url
 * @param {RequestInit} [init]
 */
async function proxyUpstream(label, url, init) {
  const started = Date.now();
  try {
    const r = await fetch(url, {
      ...init,
      signal: init?.signal ?? upstreamAbortSignal(),
    });
    const text = await r.text();
    const ms = Date.now() - started;
    console.log(
      `[haystack-proxy] ${label} → ${r.status} ${ms}ms (${text.length}b)`
    );
    return { status: r.status, contentType: r.headers.get("content-type"), text };
  } catch (e) {
    const ms = Date.now() - started;
    const timedOut =
      e instanceof Error &&
      (e.name === "TimeoutError" ||
        e.name === "AbortError" ||
        /aborted|timeout/i.test(e.message));
    console.error(
      `[haystack-proxy] ${label} failed after ${ms}ms:`,
      e instanceof Error ? e.message : e
    );
    if (timedOut) {
      const err = new Error(
        `Upstream Haystack timed out after ${UPSTREAM_TIMEOUT_MS}ms`
      );
      err.code = "UPSTREAM_TIMEOUT";
      throw err;
    }
    throw e;
  }
}

const server = http.createServer(async (req, res) => {
  const hostHdr = req.headers.host || `${HOST}:${PORT}`;
  const url = new URL(req.url || "/", `http://${hostHdr}`);

  // Health is unauthenticated and CORS-open for load balancers.
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        upstream: UPSTREAM,
        upstreamTimeoutMs: UPSTREAM_TIMEOUT_MS,
      })
    );
    return;
  }

  if (!applyCors(req, res)) {
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/fetchQuote") {
      const params = new URLSearchParams(url.search);
      // Never forward a client-supplied key; always inject the server secret.
      params.delete("apiKey");
      params.set("apiKey", API_KEY);
      const upstream = `${UPSTREAM}/api/fetchQuote?${params.toString()}`;
      const r = await proxyUpstream("fetchQuote", upstream);
      res.writeHead(r.status, {
        "Content-Type": r.contentType || "application/json",
      });
      res.end(r.text);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/fetchExecuteSwapTxns") {
      const raw = await readBody(req);
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }
      if (body && typeof body === "object") {
        delete body.apiKey;
        body.apiKey = API_KEY;
      }
      const r = await proxyUpstream("fetchExecuteSwapTxns", `${UPSTREAM}/api/fetchExecuteSwapTxns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      res.writeHead(r.status, {
        "Content-Type": r.contentType || "application/json",
      });
      res.end(r.text);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (e) {
    const timedOut =
      e &&
      typeof e === "object" &&
      "code" in e &&
      e.code === "UPSTREAM_TIMEOUT";
    const status = timedOut ? 504 : 502;
    console.error("[haystack-proxy]", e instanceof Error ? e.message : e);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Proxy upstream error",
      })
    );
  }
});

// Fail hung client connections instead of letting TCP sit forever.
server.requestTimeout = Math.max(UPSTREAM_TIMEOUT_MS + 5_000, 30_000);
server.headersTimeout = Math.max(UPSTREAM_TIMEOUT_MS + 5_000, 30_000);

server.listen(PORT, HOST, () => {
  console.log(
    `[haystack-proxy] listening on http://${HOST}:${PORT} → ${UPSTREAM}`
  );
  console.log(
    `[haystack-proxy] upstream timeout ${UPSTREAM_TIMEOUT_MS}ms; CORS: ${EFFECTIVE_CORS.join(", ") || "(none — Origin required for browser)"}`
  );
});
