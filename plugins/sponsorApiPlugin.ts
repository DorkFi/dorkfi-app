import type { Plugin } from "vite";
import { loadSponsorEnv, routeSponsorRequest } from "../server/sponsor/handlers";

/**
 * Serves `/api/easy-start/*` in Vite dev (and preview) so sponsor treasury
 * keys never ship in the browser bundle.
 */
export function sponsorApiPlugin(): Plugin {
  const env = loadSponsorEnv(process.env);

  const attach = (
    middlewares: {
      use: (
        fn: (
          req: import("node:http").IncomingMessage,
          res: import("node:http").ServerResponse,
          next: () => void
        ) => void
      ) => void;
    }
  ) => {
    middlewares.use((req, res, next) => {
      const url = req.url || "";
      if (!url.startsWith("/api/easy-start")) {
        next();
        return;
      }
      void routeSponsorRequest(req, res, env, url).then((handled) => {
        if (!handled) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unknown easy-start route" }));
        }
      });
    });
  };

  return {
    name: "dorkfi-easy-start-sponsor-api",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
