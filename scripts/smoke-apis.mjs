#!/usr/bin/env node
/**
 * Smoke-check proxies / upstream APIs the app actually uses.
 * Run against a live `npm run dev` (default http://127.0.0.1:8080).
 *
 * Usage:
 *   node scripts/smoke-apis.mjs
 *   SMOKE_BASE=http://127.0.0.1:8080 node scripts/smoke-apis.mjs
 *
 * Exit 0 if all required checks pass; 1 otherwise.
 */

const BASE = (process.env.SMOKE_BASE || "http://127.0.0.1:8080").replace(
  /\/$/,
  ""
);

/** @typedef {{ name: string; required?: boolean; ok: (status: number, body: string) => boolean; path: string; method?: string; body?: string; headers?: Record<string, string> }} SmokeCheck */

/** @type {SmokeCheck[]} */
const checks = [
  {
    name: "SPA shell",
    required: true,
    path: "/",
    ok: (status, body) => status === 200 && body.includes('id="root"'),
  },
  {
    name: "Haystack fetchQuote (proxy up)",
    required: true,
    // Real client path from haystackRouterService (Vite plugin rewrites + injects key).
    // Pass when: quote JSON (2xx), upstream validation (4xx), or proxy mounted but
    // upstream unreachable (502 fetch failed). Fail on SPA fallback (key unset) or hang.
    path: "/api/haystack/api/fetchQuote?chain=mainnet&amount=1000000&type=ExactIn&fromASAID=0&toASAID=31566704",
    ok: (status, body) => {
      // Middleware not registered → Vite serves index.html
      if (status === 200 && body.includes('id="root"')) return false;
      if (status >= 200 && status < 500) return true;
      // Proxy ran; upstream fetch failed (network / hayrouter blip)
      if (status === 502 && /fetch failed|Proxy upstream/i.test(body)) return true;
      return false;
    },
  },
  {
    name: "Orca API proxy",
    required: false,
    path: "/api/orca/v1/status",
    ok: (status) => status > 0 && status !== 502 && status !== 503,
  },
  {
    name: "Governance railway proxy",
    required: false,
    path: "/api/railway/",
    ok: (status) => status > 0 && status !== 502 && status !== 503,
  },
];

async function runCheck(check) {
  const url = `${BASE}${check.path}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: check.method || "GET",
      headers: check.headers,
      body: check.body,
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    const ms = Date.now() - t0;
    const passed = check.ok(res.status, text);
    console.log(
      `${passed ? "PASS" : "FAIL"}  ${check.name}  → ${res.status} (${ms}ms)${check.required === false ? " [optional]" : ""}`
    );
    if (!passed) {
      console.log(`      ${url}`);
      console.log(`      body: ${text.slice(0, 160).replace(/\s+/g, " ")}`);
    }
    return { passed, required: check.required !== false };
  } catch (e) {
    console.log(
      `FAIL  ${check.name}  → ${e.message}${check.required === false ? " [optional]" : ""}`
    );
    console.log(`      ${url}`);
    return { passed: false, required: check.required !== false };
  }
}

const results = [];
for (const c of checks) {
  results.push(await runCheck(c));
}

const requiredFailed = results.some((r) => r.required && !r.passed);
console.log("");
console.log(
  requiredFailed
    ? "smoke:apis — required checks FAILED"
    : "smoke:apis — required checks passed"
);
process.exit(requiredFailed ? 1 : 0);
