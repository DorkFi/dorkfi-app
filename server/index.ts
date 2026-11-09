import "./loadEnv.js";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { startShareExpirySweep } from "./lib/shareExpirySweep.js";
import { createShareApp } from "./shareApp.js";

const app = createShareApp();
startShareExpirySweep();

console.log(
  `[share-server] listening on :${config.port} (public base ${config.sharePublicBase})`
);

serve({
  fetch: app.fetch,
  port: config.port,
});
