import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import type { Plugin } from "vite";
import {
  loadOfframpEnv,
  routeOfframpRequest,
  type OfframpEnv,
} from "../server/offramp/handlers";

/** Later files win, matching Vite. Read from disk so a long-running server picks up a replaced key. */
function readOfframpEnvFromDisk(): OfframpEnv {
  const merged: Record<string, string> = {};
  for (const name of [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
  ]) {
    const filePath = path.resolve(process.cwd(), name);
    if (!existsSync(filePath)) continue;
    Object.assign(merged, parse(readFileSync(filePath)));
  }
  return loadOfframpEnv(merged);
}

/**
 * Serves `/api/offramp/*` in Vite dev (and preview) so Coinbase/MoonPay secrets
 * never ship in the browser bundle.
 */
export function offrampApiPlugin(): Plugin {
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
      void routeOfframpRequest(req, res, readOfframpEnvFromDisk(), url).then(
        (handled) => {
          if (!handled) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Unknown offramp route" }));
          }
        }
      );
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
