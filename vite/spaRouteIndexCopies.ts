import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** Deep links CloudFront/S3 would otherwise 404. Same shell as dist/index.html. */
const SPA_ROUTES = [
  "market",
  "pools",
  "portfolio",
  "governance",
  "analytics",
  "start",
  "admin",
  "gas-station",
  "liquidation-markets",
];

export function spaRouteIndexCopies(): Plugin {
  return {
    name: "spa-route-index-copies",
    apply: "build",
    closeBundle() {
      const dist = path.resolve(process.cwd(), "dist");
      const indexPath = path.join(dist, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const html = fs.readFileSync(indexPath);
      for (const route of SPA_ROUTES) {
        const dir = path.join(dist, route);
        fs.mkdirSync(dir, { recursive: true });
        // public/governance/share/index.html stays at dist/governance/share/.
        fs.writeFileSync(path.join(dir, "index.html"), html);
      }
    },
  };
}
