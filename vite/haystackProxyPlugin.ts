import type { Plugin, Connect } from "vite";
import type { IncomingMessage } from "node:http";

const UPSTREAM_DEFAULT = "https://hayrouter.txnlab.dev";

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function createHaystackMiddleware(apiKey: string, upstreamBase: string) {
  const upstream = upstreamBase.replace(/\/$/, "");

  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    const url = req.url || "";
    if (!url.startsWith("/api/haystack")) {
      next();
      return;
    }

    try {
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      const pathAndQuery = url.replace(/^\/api\/haystack/, "") || "/";

      if (req.method === "GET" && pathAndQuery.startsWith("/api/fetchQuote")) {
        const qIndex = pathAndQuery.indexOf("?");
        const search =
          qIndex >= 0 ? pathAndQuery.slice(qIndex + 1) : "";
        const params = new URLSearchParams(search);
        // Never forward a client-supplied key; always inject the server secret.
        params.delete("apiKey");
        params.set("apiKey", apiKey);
        const target = `${upstream}/api/fetchQuote?${params.toString()}`;
        const r = await fetch(target);
        const text = await r.text();
        res.statusCode = r.status;
        res.setHeader(
          "Content-Type",
          r.headers.get("content-type") || "application/json"
        );
        res.end(text);
        return;
      }

      if (
        req.method === "POST" &&
        pathAndQuery.startsWith("/api/fetchExecuteSwapTxns")
      ) {
        const raw = await readBody(req as IncomingMessage);
        let body: Record<string, unknown>;
        try {
          body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
          return;
        }
        delete body.apiKey;
        body.apiKey = apiKey;
        const r = await fetch(`${upstream}/api/fetchExecuteSwapTxns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const text = await r.text();
        res.statusCode = r.status;
        res.setHeader(
          "Content-Type",
          r.headers.get("content-type") || "application/json"
        );
        res.end(text);
        return;
      }

      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (e) {
      console.error("[haystack-proxy]", e);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: e instanceof Error ? e.message : "Proxy upstream error",
        })
      );
    }
  };

  return handler;
}

/**
 * Vite middleware that proxies Haystack Order Router calls and injects
 * `HAYSTACK_API_KEY` (server-only; never use VITE_ for this secret).
 *
 * Browser calls: `/api/haystack/api/fetchQuote` and
 * `/api/haystack/api/fetchExecuteSwapTxns`.
 */
export function haystackProxyPlugin(env: Record<string, string>): Plugin {
  const apiKey = (env.HAYSTACK_API_KEY || "").trim();
  const upstream = (env.HAYSTACK_API_BASE || UPSTREAM_DEFAULT).trim();

  return {
    name: "haystack-proxy",
    configureServer(server) {
      if (!apiKey) {
        console.warn(
          "[haystack-proxy] HAYSTACK_API_KEY unset — /api/haystack disabled"
        );
        return;
      }
      server.middlewares.use(createHaystackMiddleware(apiKey, upstream));
      console.log("[haystack-proxy] /api/haystack →", upstream);
    },
    configurePreviewServer(server) {
      if (!apiKey) return;
      server.middlewares.use(createHaystackMiddleware(apiKey, upstream));
    },
  };
}
