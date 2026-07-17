import type { Plugin } from "vite";
import {
  loadOfframpEnv,
  routeOfframpRequest,
} from "../server/offramp/handlers";

/**
 * Serves `/api/offramp/*` in Vite dev (and preview) so Coinbase/MoonPay secrets
 * never ship in the browser bundle.
 */
export function offrampApiPlugin(): Plugin {
  const env = loadOfframpEnv(process.env);

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
      if (!url.startsWith("/api/offramp")) {
        next();
        return;
      }
      void routeOfframpRequest(req, res, env, url).then((handled) => {
        if (!handled) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unknown offramp route" }));
        }
      });
    });
  };

  return {
    name: "dorkfi-offramp-api",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
