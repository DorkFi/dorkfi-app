import http from "node:http";
import {
  HAYSTACK_PROXY_DEFAULTS,
  createHaystackProxy,
  proxyClientIp,
  readProxySettings,
  sanitizeUpstreamBody,
} from "../haystack-proxy.mjs";

const API_KEY = "hay_sk_test_proxy_key_0123456789";
const ALLOWED = "https://app.dork.fi";

function jsonResponse(body, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

/**
 * @param {object} opts
 * @param {(url: string, init?: RequestInit) => Promise<Response>} [opts.fetchImpl]
 */
async function withProxy(opts, fn) {
  /** @type {{ url: string, init: RequestInit | undefined }[]} */
  const calls = [];
  const server = createHaystackProxy({
    apiKey: API_KEY,
    upstream: "https://haystack.test",
    corsOrigins: [ALLOWED, "http://localhost:8080"],
    ipRateMax: opts.ipRateMax ?? 100,
    ipRateWindowMs: opts.ipRateWindowMs ?? 60_000,
    globalRateMax: opts.globalRateMax ?? 100,
    globalRateWindowMs: opts.globalRateWindowMs ?? 60_000,
    dailyBudget: opts.dailyBudget ?? 100,
    maxBodyBytes: opts.maxBodyBytes ?? 128 * 1024,
    now: opts.now ?? (() => Date.now()),
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      if (opts.fetchImpl) return opts.fetchImpl(url, init);
      return jsonResponse({ quote: 1, txnPayload: { iv: "aa", data: "bb" } });
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not bind a port");
  }
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await fn(base, calls);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

function quoteUrl(base, extra = "") {
  return `${base}/api/fetchQuote?chain=mainnet&amount=1&type=fixed-output&fromASAID=0&toASAID=31566704${extra}`;
}

describe("haystack proxy", () => {
  it("rejects quote and execute requests that omit Origin", async () => {
    await withProxy({}, async (base, calls) => {
      const quote = await fetch(quoteUrl(base));
      expect(quote.status).toBe(401);
      expect(await quote.json()).toEqual({ error: "Origin required" });

      const execute = await fetch(`${base}/api/fetchExecuteSwapTxns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: "ABC", slippage: 1 }),
      });
      expect(execute.status).toBe(401);
      expect(await execute.json()).toEqual({ error: "Origin required" });
      expect(calls).toHaveLength(0);
    });
  });

  it("still rejects a disallowed Origin", async () => {
    await withProxy({}, async (base, calls) => {
      const res = await fetch(quoteUrl(base), {
        headers: { Origin: "https://evil.example" },
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Origin not allowed" });
      expect(calls).toHaveLength(0);
    });
  });

  it("serves health with no Origin and does not call Haystack", async () => {
    await withProxy({}, async (base, calls) => {
      const res = await fetch(`${base}/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(calls).toHaveLength(0);
    });
  });

  it("quotes from an allowed origin and strips a client apiKey", async () => {
    await withProxy({}, async (base, calls) => {
      const res = await fetch(quoteUrl(base, "&apiKey=client-secret"), {
        headers: {
          Origin: ALLOWED,
          "X-API-Key": "browser-placeholder",
        },
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ quote: 1 });
      expect(calls).toHaveLength(1);
      const upstream = new URL(calls[0].url);
      expect(upstream.pathname).toBe("/api/fetchQuote");
      expect(upstream.searchParams.has("apiKey")).toBe(false);
      expect(upstream.searchParams.get("amount")).toBe("1");
      expect(calls[0].url).not.toContain("client-secret");
      expect(calls[0].init?.headers).toEqual({ "X-API-Key": API_KEY });
    });
  });

  it("strips apiKey from the execute body and from the upstream JSON", async () => {
    await withProxy(
      {
        fetchImpl: async () =>
          jsonResponse({
            txns: [{ data: "abc", logicSigBlob: false }],
            apiKey: API_KEY,
            nested: { apiKey: "also-secret", ok: true },
          }),
      },
      async (base, calls) => {
        const res = await fetch(`${base}/api/fetchExecuteSwapTxns`, {
          method: "POST",
          headers: {
            Origin: ALLOWED,
            "Content-Type": "application/json",
            "X-API-Key": "browser-placeholder",
          },
          body: JSON.stringify({
            address: "ABC",
            slippage: 1,
            apiKey: "client-secret",
            txnPayloadJSON: { iv: "aa", data: "bb" },
          }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.apiKey).toBeUndefined();
        expect(json.nested).toEqual({ ok: true });
        expect(JSON.stringify(json)).not.toContain(API_KEY);
        expect(JSON.stringify(json)).not.toContain("client-secret");

        const forwarded = JSON.parse(String(calls[0].init?.body));
        expect(forwarded.apiKey).toBeUndefined();
        expect(forwarded.address).toBe("ABC");
        expect(calls[0].init?.headers).toEqual({
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        });
      }
    );
  });

  it("strips apiKey from an upstream error body", async () => {
    await withProxy(
      {
        fetchImpl: async () =>
          jsonResponse({ error: "rejected", apiKey: API_KEY }, 401),
      },
      async (base) => {
        const res = await fetch(quoteUrl(base), {
          headers: { Origin: ALLOWED },
        });
        expect(res.status).toBe(401);
        const text = await res.text();
        expect(text).not.toContain(API_KEY);
        expect(JSON.parse(text)).toEqual({ error: "rejected" });
      }
    );
  });

  it("rejects an over-limit execute body and does not call Haystack", async () => {
    await withProxy({ maxBodyBytes: 32 }, async (base, calls) => {
      const res = await fetch(`${base}/api/fetchExecuteSwapTxns`, {
        method: "POST",
        headers: {
          Origin: ALLOWED,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ padding: "x".repeat(80) }),
      });
      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ error: "Payload too large" });
      expect(calls).toHaveLength(0);
    });
  });

  it("rate-limits per X-Real-IP and ignores X-Forwarded-For", async () => {
    await withProxy({ ipRateMax: 1, globalRateMax: 10 }, async (base, calls) => {
      const headersFor = (ip, forwarded) => ({
        Origin: ALLOWED,
        "X-Real-IP": ip,
        "X-Forwarded-For": forwarded,
      });
      const first = await fetch(quoteUrl(base), {
        headers: headersFor("203.0.113.10", "198.51.100.1"),
      });
      const second = await fetch(quoteUrl(base), {
        headers: headersFor("203.0.113.10", "198.51.100.2"),
      });
      const other = await fetch(quoteUrl(base), {
        headers: headersFor("203.0.113.11", "198.51.100.1"),
      });
      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
      expect(await second.json()).toEqual({ error: "Rate limit exceeded" });
      expect(other.status).toBe(200);
      expect(calls).toHaveLength(2);
    });
  });

  it("shares one bucket when X-Real-IP is missing", async () => {
    await withProxy({ ipRateMax: 1, globalRateMax: 10 }, async (base) => {
      const first = await fetch(quoteUrl(base), {
        headers: { Origin: ALLOWED, "X-Forwarded-For": "203.0.113.8" },
      });
      const second = await fetch(quoteUrl(base), {
        headers: { Origin: ALLOWED, "X-Forwarded-For": "203.0.113.9" },
      });
      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
    });
  });

  it("returns 429 once the global limit is spent", async () => {
    await withProxy({ ipRateMax: 10, globalRateMax: 2 }, async (base, calls) => {
      const statuses = [];
      for (const ip of ["203.0.113.1", "203.0.113.2", "203.0.113.3"]) {
        const res = await fetch(quoteUrl(base), {
          headers: { Origin: ALLOWED, "X-Real-IP": ip },
        });
        statuses.push(res.status);
        await res.arrayBuffer();
      }
      expect(statuses).toEqual([200, 200, 429]);
      expect(calls).toHaveLength(2);
    });
  });

  it("stops calling Haystack once the daily budget is spent", async () => {
    const clock = { t: Date.UTC(2026, 0, 1, 12) };
    await withProxy(
      { dailyBudget: 1, now: () => clock.t },
      async (base, calls) => {
        const headers = { Origin: ALLOWED, "X-Real-IP": "203.0.113.20" };
        const first = await fetch(quoteUrl(base), { headers });
        const second = await fetch(quoteUrl(base), { headers });
        expect(first.status).toBe(200);
        expect(second.status).toBe(429);
        expect(await second.json()).toEqual({ error: "Daily budget exceeded" });
        expect(calls).toHaveLength(1);

        clock.t = Date.UTC(2026, 0, 2, 0, 1);
        const nextDay = await fetch(quoteUrl(base), { headers });
        expect(nextDay.status).toBe(200);
        expect(calls).toHaveLength(2);
      }
    );
  });

  it("does not log the injected key when upstream fails", async () => {
    const errors = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.map(String).join(" "));
    });
    try {
      await withProxy(
        {
          fetchImpl: async () => {
            throw new Error(`upstream blew up with ${API_KEY}`);
          },
        },
        async (base) => {
          const res = await fetch(quoteUrl(base), {
            headers: { Origin: ALLOWED },
          });
          expect(res.status).toBe(502);
          const text = await res.text();
          expect(text).not.toContain(API_KEY);
          expect(text).toContain("[redacted]");
        }
      );
    } finally {
      spy.mockRestore();
    }
    expect(errors.join("\n")).not.toContain(API_KEY);
    expect(errors.join("\n")).toContain("[redacted]");
  });

  it("opens the rate window again after it expires", async () => {
    const clock = { t: 1_000_000 };
    await withProxy(
      {
        ipRateMax: 1,
        ipRateWindowMs: 1_000,
        now: () => clock.t,
      },
      async (base) => {
        const headers = { Origin: ALLOWED, "X-Real-IP": "203.0.113.30" };
        expect((await fetch(quoteUrl(base), { headers })).status).toBe(200);
        const blocked = await fetch(quoteUrl(base), { headers });
        expect(blocked.status).toBe(429);
        await blocked.arrayBuffer();
        clock.t += 1_001;
        expect((await fetch(quoteUrl(base), { headers })).status).toBe(200);
      }
    );
  });
});

describe("haystack proxy helpers", () => {
  it("uses the documented defaults", () => {
    const settings = readProxySettings({});
    expect(settings.ipRateMax).toBe(HAYSTACK_PROXY_DEFAULTS.ipRateMax);
    expect(settings.globalRateMax).toBe(HAYSTACK_PROXY_DEFAULTS.globalRateMax);
    expect(settings.dailyBudget).toBe(HAYSTACK_PROXY_DEFAULTS.dailyBudget);
    expect(settings.maxBodyBytes).toBe(HAYSTACK_PROXY_DEFAULTS.maxBodyBytes);
    expect(settings.corsOrigins).toContain("http://localhost:8080");
  });

  it("keeps an explicit daily budget of zero", () => {
    expect(readProxySettings({ HAYSTACK_PROXY_DAILY_BUDGET: "0" }).dailyBudget).toBe(
      0
    );
  });

  it("keys clients on X-Real-IP only", () => {
    expect(
      proxyClientIp({
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.4",
      })
    ).toBe("203.0.113.10");
    expect(proxyClientIp({ "x-forwarded-for": "198.51.100.4" })).toBe(
      "127.0.0.1"
    );
  });

  it("removes apiKey fields and the raw key from a non-JSON body", () => {
    expect(
      sanitizeUpstreamBody(
        `nope ${API_KEY}`,
        "text/plain",
        API_KEY
      )
    ).toBe("nope [redacted]");
    expect(
      JSON.parse(
        sanitizeUpstreamBody(
          JSON.stringify({ apiKey: API_KEY, quote: 3 }),
          "application/json",
          API_KEY
        )
      )
    ).toEqual({ quote: 3 });
  });
});

describe("haystack proxy listen", () => {
  it("rejects a declared content-length above the cap", async () => {
    await withProxy({ maxBodyBytes: 64 }, async (base, calls) => {
      const status = await new Promise((resolve, reject) => {
        const url = new URL(`${base}/api/fetchExecuteSwapTxns`);
        const req = http.request(
          {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: "POST",
            headers: {
              Origin: ALLOWED,
              "Content-Type": "application/json",
              "Content-Length": "500",
            },
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve(res.statusCode));
          }
        );
        req.on("error", reject);
        req.end("{}");
      });
      expect(status).toBe(413);
      expect(calls).toHaveLength(0);
    });
  });
});
