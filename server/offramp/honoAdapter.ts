/**
 * Mounts the Node Coinbase handlers on the Hono share server.
 * Vite dev still uses plugins/offrampApiPlugin.ts.
 */
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Context } from "hono";
import { loadOfframpEnv, routeOfframpRequest } from "./handlers";

const env = loadOfframpEnv(process.env);

export async function handleHonoOfframp(c: Context): Promise<Response> {
  const url = new URL(c.req.url);
  const pathAndQuery = `${url.pathname}${url.search}`;
  const body = Buffer.from(await c.req.arrayBuffer());
  const req = Readable.from([body]) as IncomingMessage;
  req.method = c.req.method;
  req.url = pathAndQuery;
  req.headers = {};
  c.req.raw.headers.forEach((value, key) => {
    req.headers[key.toLowerCase()] = value;
  });

  const headers = new Map<string, string>();
  let payload = "";
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(
        name,
        Array.isArray(value) ? value.join(", ") : String(value)
      );
    },
    end(chunk?: string) {
      payload = typeof chunk === "string" ? chunk : "";
    },
  } as ServerResponse;

  const handled = await routeOfframpRequest(req, res, env, pathAndQuery);
  if (!handled) {
    return c.json({ error: "Unknown offramp route" }, 404);
  }

  return new Response(payload, {
    status: res.statusCode || 200,
    headers: Object.fromEntries(headers),
  });
}
