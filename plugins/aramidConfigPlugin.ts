import type { Plugin } from "vite";

const UPSTREAM =
  "https://beta.k8s.aramid.finance/public-configuration.json";
const CACHE_MS = 5 * 60 * 1000;

/**
 * Serves the live Aramid route table at `/api/aramid-config` during Vite
 * dev and preview. The upstream host does not allow browser CORS.
 */
export function aramidConfigPlugin(): Plugin {
  let cache: { at: number; body: string } | null = null;

  const attach = (middlewares: {
    use: (
      fn: (
        req: import("node:http").IncomingMessage,
        res: import("node:http").ServerResponse,
        next: () => void
      ) => void
    ) => void;
  }) => {
    middlewares.use((req, res, next) => {
      const url = req.url || "";
      if (!url.startsWith("/api/aramid-config")) {
        next();
        return;
      }
      void (async () => {
        try {
          if (!cache || Date.now() - cache.at > CACHE_MS) {
            const upstream = await fetch(UPSTREAM);
            if (!upstream.ok) {
              throw new Error(`Bridge config ${upstream.status}`);
            }
            cache = { at: Date.now(), body: await upstream.text() };
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(cache.body);
        } catch (error) {
          console.error("[aramid-config]", error);
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Could not load bridge routes." }));
        }
      })();
    });
  };

  return {
    name: "dorkfi-aramid-config",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
