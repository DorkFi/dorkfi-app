import type { Plugin } from "vite";
import {
  loadXoSwapEnv,
  routeXoSwapRequest,
} from "../server/xoSwap/handlers";

/**
 * Serves `/api/xo-swap/*` in Vite dev (and preview) so Exodus App-Name /
 * API credentials never ship in the browser bundle.
 */
export function xoSwapApiPlugin(): Plugin {
  const env = loadXoSwapEnv(process.env);

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
      if (!url.startsWith("/api/xo-swap")) {
        next();
        return;
      }
      void routeXoSwapRequest(req, res, env, url).then((handled) => {
        if (!handled) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Unknown xo-swap route" }));
        }
      });
    });
  };

  return {
    name: "dorkfi-xo-swap-api",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
