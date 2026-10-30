import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { handleHonoOfframp } from "./honoAdapter";

describe("share-server offramp mount", () => {
  it("serves Coinbase health on /api/offramp/health", async () => {
    const app = new Hono();
    app.all("/api/offramp/*", (c) => handleHonoOfframp(c));

    const res = await app.request("http://share.test/api/offramp/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      coinbase: boolean;
    };
    expect(body.ok).toBe(true);
    expect(typeof body.coinbase).toBe("boolean");
  });

  it("returns 404 for an unknown offramp path", async () => {
    const app = new Hono();
    app.all("/api/offramp/*", (c) => handleHonoOfframp(c));

    const res = await app.request("http://share.test/api/offramp/nope");
    expect(res.status).toBe(404);
  });
});
