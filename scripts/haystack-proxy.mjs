#!/usr/bin/env node
/**
 * Standalone Haystack Order Router proxy.
 * Keeps HAYSTACK_API_KEY on the server — never expose it via VITE_*.
 *
 * Local:
 *   HAYSTACK_API_KEY=… npm run haystack-proxy
 *   # http://127.0.0.1:8791
 *   # Quote and execute require an allowlisted Origin (health does not):
 *   # curl -H 'Origin: http://localhost:8080' 'http://127.0.0.1:8791/api/fetchQuote?…'
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
 *   HAYSTACK_API_KEY                     (required)
 *   HAYSTACK_PROXY_PORT                  (default 8791; also accepts platform `PORT`)
 *   HAYSTACK_PROXY_HOST                  (default 127.0.0.1; use 0.0.0.0 to bind publicly)
 *   HAYSTACK_PROXY_CORS_ORIGINS          (comma-separated; required when host is not loopback)
 *   HAYSTACK_API_BASE                    (default https://hayrouter.txnlab.dev)
 *   HAYSTACK_PROXY_IP_RATE_MAX           (default 30 requests / window / IP)
 *   HAYSTACK_PROXY_IP_RATE_WINDOW_MS     (default 60000)
 *   HAYSTACK_PROXY_GLOBAL_RATE_MAX       (default 60 requests / window)
 *   HAYSTACK_PROXY_GLOBAL_RATE_WINDOW_MS (default 60000)
 *   HAYSTACK_PROXY_DAILY_BUDGET          (default 2000 upstream calls / UTC day)
 *   HAYSTACK_PROXY_MAX_BODY_BYTES        (default 131072)
 */

import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const HAYSTACK_PROXY_DEFAULTS = {
  ipRateMax: 30,
  ipRateWindowMs: 60_000,
  /** Shared free-tier quota. The proxy stops before Haystack starts rejecting. */
  globalRateMax: 60,
  globalRateWindowMs: 60_000,
  /** A few hundred repay sessions. Burning it is the loss limit for a script. */
  dailyBudget: 2_000,
  maxBodyBytes: 128 * 1024,
};

const LOCAL_DEV_ORIGINS = [
  "http://127.0.0.1:8080",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

/**
 * Railway overwrites X-Real-IP. It forwards X-Forwarded-For and CF-Connecting-IP
 * unchanged, so those can be spoofed. Missing X-Real-IP shares one bucket.
 * @param {http.IncomingHttpHeaders} headers
 */
export function proxyClientIp(headers) {
  const raw = headers["x-real-ip"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === "string") {
    const ip = value.split(",")[0]?.trim();
    if (ip) return ip;
  }
  return "127.0.0.1";
}

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

function intSetting(raw, fallback, { min = 0 } = {}) {
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < min) return fallback;
  return n;
}

/**
 * @param {NodeJS.ProcessEnv} env
 */
export function readProxySettings(env) {
  const host = (env.HAYSTACK_PROXY_HOST || "127.0.0.1").trim();
  const configured = parseCorsOrigins(env.HAYSTACK_PROXY_CORS_ORIGINS);
  const corsOrigins =
    configured.length > 0
      ? configured
      : isLoopbackHost(host)
        ? [...LOCAL_DEV_ORIGINS]
        : [];
  return {
    apiKey: env.HAYSTACK_API_KEY?.trim() || "",
    port: Number(env.HAYSTACK_PROXY_PORT || env.PORT || 8791),
    host,
    upstream: (
      env.HAYSTACK_API_BASE || "https://hayrouter.txnlab.dev"
    ).replace(/\/$/, ""),
    corsOrigins,
    ipRateMax: intSetting(
      env.HAYSTACK_PROXY_IP_RATE_MAX,
      HAYSTACK_PROXY_DEFAULTS.ipRateMax
    ),
    ipRateWindowMs: intSetting(
      env.HAYSTACK_PROXY_IP_RATE_WINDOW_MS,
      HAYSTACK_PROXY_DEFAULTS.ipRateWindowMs,
      { min: 1 }
    ),
    globalRateMax: intSetting(
      env.HAYSTACK_PROXY_GLOBAL_RATE_MAX,
      HAYSTACK_PROXY_DEFAULTS.globalRateMax
    ),
    globalRateWindowMs: intSetting(
      env.HAYSTACK_PROXY_GLOBAL_RATE_WINDOW_MS,
      HAYSTACK_PROXY_DEFAULTS.globalRateWindowMs,
      { min: 1 }
    ),
    dailyBudget: intSetting(
      env.HAYSTACK_PROXY_DAILY_BUDGET,
      HAYSTACK_PROXY_DEFAULTS.dailyBudget
    ),
    maxBodyBytes: intSetting(
      env.HAYSTACK_PROXY_MAX_BODY_BYTES,
      HAYSTACK_PROXY_DEFAULTS.maxBodyBytes,
      { min: 1 }
    ),
  };
}

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function createSlidingWindowLimiter({ max, windowMs, now }) {
  /** @type {Map<string, number[]>} */
  const hits = new Map();
  return {
    /**
     * @param {string} key
     * @returns {boolean}
     */
    allow(key) {
      const t = now();
      const cutoff = t - windowMs;
      const prev = (hits.get(key) ?? []).filter((ts) => ts > cutoff);
      if (prev.length >= max) {
        hits.set(key, prev);
        return false;
      }
      prev.push(t);
      hits.set(key, prev);
      return true;
    },
  };
}

function redactSecret(text, apiKey) {
  if (!apiKey || apiKey.length < 8 || !text.includes(apiKey)) return text;
  return text.split(apiKey).join("[redacted]");
}

function stripApiKeyFields(value) {
  if (Array.isArray(value)) return value.map(stripApiKeyFields);
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key.toLowerCase() === "apikey") continue;
      out[key] = stripApiKeyFields(nested);
    }
    return out;
  }
  return value;
}

/**
 * @param {string} text
 * @param {string | null} contentType
 * @param {string} apiKey
 */
export function sanitizeUpstreamBody(text, contentType, apiKey) {
  let out = text;
  const trimmed = text.trim();
  const looksJson =
    (contentType || "").toLowerCase().includes("json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");
  if (looksJson && trimmed) {
    try {
      out = JSON.stringify(stripApiKeyFields(JSON.parse(text)));
    } catch {
      out = text;
    }
  }
  return redactSecret(out, apiKey);
}

function deleteApiKeyParams(params) {
  for (const key of [...params.keys()]) {
    if (key.toLowerCase() === "apikey") params.delete(key);
  }
}

function deleteApiKeyFields(body) {
  if (!body || typeof body !== "object") return;
  for (const key of Object.keys(body)) {
    if (key.toLowerCase() === "apikey") delete body[key];
  }
}

function sendJson(res, status, body, extraHeaders) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

function originValue(req) {
  const raw = req.headers.origin;
  if (typeof raw !== "string") return "";
  return raw.trim();
}

/**
 * @param {http.IncomingMessage} req
 * @param {number} maxBytes
 * @returns {Promise<{ ok: true, text: string } | { ok: false }>}
 */
function readBodyLimited(req, maxBytes) {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    req.resume();
    return Promise.resolve({ ok: false });
  }
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let total = 0;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    req.on("data", (chunk) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > maxBytes) {
        req.pause();
        finish({ ok: false });
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      finish({ ok: true, text: Buffer.concat(chunks).toString("utf8") });
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

/**
 * @param {ReturnType<typeof readProxySettings> & { fetch?: typeof fetch, now?: () => number }} settings
 */
export function createHaystackProxy(settings) {
  if (!settings.apiKey) {
    throw new Error("HAYSTACK_API_KEY is required");
  }
  const now = settings.now ?? (() => Date.now());
  const fetchImpl = settings.fetch ?? globalThis.fetch;
  const ipLimiter = createSlidingWindowLimiter({
    max: settings.ipRateMax,
    windowMs: settings.ipRateWindowMs,
    now,
  });
  const globalLimiter = createSlidingWindowLimiter({
    max: settings.globalRateMax,
    windowMs: settings.globalRateWindowMs,
    now,
  });
  let budgetDay = utcDay(now());
  let budgetSpent = 0;

  function takeDailyBudget() {
    const day = utcDay(now());
    if (day !== budgetDay) {
      budgetDay = day;
      budgetSpent = 0;
    }
    if (budgetSpent >= settings.dailyBudget) return false;
    budgetSpent += 1;
    return true;
  }

  /**
   * Quote and execute only. Health and CORS preflight do not spend quota.
   * @param {http.IncomingMessage} req
   */
  function allowRate(req) {
    const ip = proxyClientIp(req.headers);
    if (!ipLimiter.allow(ip)) return false;
    if (!globalLimiter.allow("global")) return false;
    return true;
  }

  /**
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  function allowOrigin(req, res) {
    const origin = originValue(req);
    if (!origin) {
      sendJson(res, 401, { error: "Origin required" });
      return false;
    }
    const normalized = origin.replace(/\/$/, "");
    if (!settings.corsOrigins.includes(normalized)) {
      sendJson(res, 403, { error: "Origin not allowed" });
      return false;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    return true;
  }

  /**
   * @param {http.ServerResponse} res
   * @param {Response} upstreamRes
   */
  async function writeUpstream(res, upstreamRes) {
    const text = await upstreamRes.text();
    const contentType =
      upstreamRes.headers.get("content-type") || "application/json";
    const safe = sanitizeUpstreamBody(text, contentType, settings.apiKey);
    const type = contentType.toLowerCase().includes("json")
      ? "application/json"
      : contentType;
    res.writeHead(upstreamRes.status, { "Content-Type": type });
    res.end(safe);
  }

  const server = http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url || "/", "http://127.0.0.1");
    } catch {
      sendJson(res, 400, { error: "Bad request" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (!allowOrigin(req, res)) return;

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const isQuote = req.method === "GET" && url.pathname === "/api/fetchQuote";
    const isExecute =
      req.method === "POST" && url.pathname === "/api/fetchExecuteSwapTxns";
    if (!isQuote && !isExecute) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (!allowRate(req)) {
      sendJson(res, 429, { error: "Rate limit exceeded" }, { "Retry-After": "60" });
      req.resume();
      return;
    }

    try {
      if (isQuote) {
        const params = new URLSearchParams(url.search);
        deleteApiKeyParams(params);
        if (!takeDailyBudget()) {
          sendJson(res, 429, { error: "Daily budget exceeded" });
          return;
        }
        const qs = params.toString();
        const upstream = `${settings.upstream}/api/fetchQuote${qs ? `?${qs}` : ""}`;
        const upstreamRes = await fetchImpl(upstream, {
          headers: { "X-API-Key": settings.apiKey },
        });
        await writeUpstream(res, upstreamRes);
        return;
      }

      const bodyResult = await readBodyLimited(req, settings.maxBodyBytes);
      if (!bodyResult.ok) {
        sendJson(res, 413, { error: "Payload too large" });
        return;
      }
      let body;
      try {
        body = bodyResult.text ? JSON.parse(bodyResult.text) : {};
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return;
      }
      deleteApiKeyFields(body);
      if (!takeDailyBudget()) {
        sendJson(res, 429, { error: "Daily budget exceeded" });
        return;
      }
      const upstreamRes = await fetchImpl(
        `${settings.upstream}/api/fetchExecuteSwapTxns`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": settings.apiKey,
          },
          body: JSON.stringify(body),
        }
      );
      await writeUpstream(res, upstreamRes);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Proxy upstream error";
      console.error("[haystack-proxy]", redactSecret(message, settings.apiKey));
      if (!res.headersSent) {
        sendJson(res, 502, {
          error: redactSecret(message, settings.apiKey),
        });
      }
    }
  });

  return server;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

function main() {
  const settings = readProxySettings(process.env);
  if (!settings.apiKey) {
    console.error("HAYSTACK_API_KEY is required");
    process.exit(1);
  }
  if (!isLoopbackHost(settings.host) && settings.corsOrigins.length === 0) {
    console.error(
      "HAYSTACK_PROXY_CORS_ORIGINS is required when HAYSTACK_PROXY_HOST is not loopback.\n" +
        "Example: HAYSTACK_PROXY_CORS_ORIGINS=https://beta.dork.fi,https://app.dork.fi"
    );
    process.exit(1);
  }
  const server = createHaystackProxy(settings);
  server.listen(settings.port, settings.host, () => {
    console.log(
      `[haystack-proxy] listening on http://${settings.host}:${settings.port} → ${settings.upstream}`
    );
    console.log(
      `[haystack-proxy] CORS allowlist: ${settings.corsOrigins.join(", ")}`
    );
    console.log(
      `[haystack-proxy] limits: ${settings.ipRateMax}/IP/${settings.ipRateWindowMs}ms, ${settings.globalRateMax} global/${settings.globalRateWindowMs}ms, ${settings.dailyBudget}/UTC day, body ${settings.maxBodyBytes} bytes`
    );
  });
}

if (isDirectRun()) {
  main();
}
