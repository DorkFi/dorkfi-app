import { mkdir, mkdtemp, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { config } from "../../config.js";
import { resetBorrowShareStoreForTests } from "../borrowShareStore.js";
import { resetProfileShareStoreForTests } from "../profileShareStore.js";
import { resetRepayShareStoreForTests } from "../repayShareStore.js";
import { sweepAllShareStores } from "../shareExpirySweep.js";
import {
  isPngBuffer,
  readShareField,
  SHARE_MAX_BODY_BYTES,
  SHARE_MAX_FIELD_CHARS,
  shareClientIpFromHeaders,
} from "../shareUpload.js";
import { createShareApp } from "../../shareApp.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 1×1 PNG. */
const MIN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const ROUTES = [
  {
    name: "repay",
    path: "/share/repay-confirmation/link",
    fields: {
      amount: "1.5",
      assetSymbol: "USDC",
      paidWithSymbol: "ALGO",
      network: "Algorand",
    },
    requiredField: "assetSymbol",
    imagePath: (id: string) => `/repay/${id}/image.png`,
  },
  {
    name: "borrow",
    path: "/share/borrow-confirmation/link",
    fields: {
      amount: "2",
      assetSymbol: "USDC",
      network: "Voi",
    },
    requiredField: "assetSymbol",
    imagePath: (id: string) => `/borrow/${id}/image.png`,
  },
  {
    name: "profile",
    path: "/share/profile-update/link",
    fields: {
      nftName: "DORK 12",
      collectionId: "dorks_v1",
      contractId: "12345",
    },
    requiredField: "nftName",
    imagePath: (id: string) => `/profile/${id}/image.png`,
  },
];

const STORE_ENV = [
  "X_REPAY_SHARE_STORE_PATH",
  "X_BORROW_SHARE_STORE_PATH",
  "X_PROFILE_SHARE_STORE_PATH",
] as const;

function resetStores(): void {
  resetRepayShareStoreForTests();
  resetBorrowShareStoreForTests();
  resetProfileShareStoreForTests();
}

async function countPngs(root: string): Promise<number> {
  let count = 0;
  for (const name of ["repay", "borrow", "profile"]) {
    let entries: string[] = [];
    try {
      entries = await readdir(path.join(root, name));
    } catch {
      continue;
    }
    count += entries.filter((entry) => entry.endsWith(".png")).length;
  }
  return count;
}

function postShare(
  app: Hono,
  routePath: string,
  fields: Record<string, string>,
  file: Uint8Array,
  ip = "203.0.113.10"
): Promise<Response> {
  const form = new FormData();
  form.append(
    "image",
    new File([new Uint8Array(file)], "card.png", { type: "image/png" })
  );
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  const request = new Request(`http://share.test${routePath}`, {
    method: "POST",
    body: form,
  });
  request.headers.set("x-real-ip", ip);
  return app.request(request);
}

describe("share upload limits", () => {
  let root: string;
  let app: Hono;
  const previousEnv = new Map<string, string | undefined>();

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "dorkfi-share-"));
    for (const key of STORE_ENV) {
      previousEnv.set(key, process.env[key]);
    }
    process.env.X_REPAY_SHARE_STORE_PATH = path.join(root, "repay");
    process.env.X_BORROW_SHARE_STORE_PATH = path.join(root, "borrow");
    process.env.X_PROFILE_SHARE_STORE_PATH = path.join(root, "profile");
    resetStores();
    app = createShareApp();
  });

  afterEach(async () => {
    resetStores();
    for (const key of STORE_ENV) {
      const previous = previousEnv.get(key);
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
    await rm(root, { recursive: true, force: true });
  });

  it("recognizes a PNG signature and caps text fields", () => {
    expect(isPngBuffer(MIN_PNG)).toBe(true);
    expect(isPngBuffer(Buffer.from("not a png"))).toBe(false);
    expect(readShareField("  USDC  ", "assetSymbol", { required: true })).toEqual({
      ok: true,
      value: "USDC",
    });
    expect(
      readShareField("x".repeat(SHARE_MAX_FIELD_CHARS + 1), "amount").ok
    ).toBe(false);
    expect(readShareField("   ", "assetSymbol", { required: true }).ok).toBe(false);
  });

  it("defaults the share TTL to 7 days", () => {
    const keys = [
      "X_REPAY_SHARE_TTL_DAYS",
      "X_BORROW_SHARE_TTL_DAYS",
      "X_PROFILE_SHARE_TTL_DAYS",
    ] as const;
    const saved = keys.map((key) => [key, process.env[key]] as const);
    try {
      for (const key of keys) delete process.env[key];
      expect(config.repayShareTtlMs).toBe(7 * DAY_MS);
      expect(config.borrowShareTtlMs).toBe(7 * DAY_MS);
      expect(config.profileShareTtlMs).toBe(7 * DAY_MS);
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("uses the edge IP and falls back to X-Forwarded-For", () => {
    expect(
      shareClientIpFromHeaders({
        "x-real-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.4",
      })
    ).toBe("203.0.113.10");
    expect(
      shareClientIpFromHeaders({
        "x-forwarded-for": "198.51.100.4, 10.0.0.1",
      })
    ).toBe("198.51.100.4");
    expect(shareClientIpFromHeaders({})).toBe("127.0.0.1");
  });

  it.each(ROUTES)(
    "returns a share URL for a normal $name PNG",
    async (route) => {
      const response = await postShare(app, route.path, route.fields, MIN_PNG);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        shareId: string;
        shareUrl: string;
      };
      expect(body.shareUrl).toContain(`${route.imagePath(body.shareId).replace("/image.png", "")}`);
      expect(await countPngs(root)).toBe(1);

      const image = await app.request(
        `http://share.test${route.imagePath(body.shareId)}`
      );
      expect(image.status).toBe(200);
      expect(image.headers.get("x-content-type-options")).toBe("nosniff");
      expect(image.headers.get("content-type")).toContain("image/png");
    }
  );

  it.each(ROUTES)(
    "rejects an over-limit $name body with 413 and writes nothing",
    async (route) => {
      const oversized = new Uint8Array(SHARE_MAX_BODY_BYTES + 1);
      const response = await postShare(app, route.path, route.fields, oversized);
      expect(response.status).toBe(413);
      expect(await countPngs(root)).toBe(0);
    }
  );

  it.each(ROUTES)(
    "rejects a non-PNG $name payload with 400 and writes nothing",
    async (route) => {
      const response = await postShare(
        app,
        route.path,
        route.fields,
        Buffer.from("hello")
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/png/i);
      expect(await countPngs(root)).toBe(0);
    }
  );

  it.each(ROUTES)(
    "rejects an over-long $name text field and writes nothing",
    async (route) => {
      const response = await postShare(app, route.path, {
        ...route.fields,
        [route.requiredField]: "A".repeat(SHARE_MAX_FIELD_CHARS + 1),
      }, MIN_PNG);
      expect(response.status).toBe(400);
      expect(await countPngs(root)).toBe(0);
    }
  );

  it("rejects an over-long optional repay field", async () => {
    const response = await postShare(
      app,
      ROUTES[0].path,
      { ...ROUTES[0].fields, network: "n".repeat(SHARE_MAX_FIELD_CHARS + 1) },
      MIN_PNG
    );
    expect(response.status).toBe(400);
    expect(await countPngs(root)).toBe(0);
  });

  it("rate-limits repeated creates from one client", async () => {
    app = createShareApp({ rateLimit: { max: 2, windowMs: 60_000 } });
    const route = ROUTES[0];
    const first = await postShare(app, route.path, route.fields, MIN_PNG);
    const second = await postShare(app, route.path, route.fields, MIN_PNG);
    const third = await postShare(app, route.path, route.fields, MIN_PNG);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(await countPngs(root)).toBe(2);

    const otherClient = await postShare(
      app,
      route.path,
      route.fields,
      MIN_PNG,
      "203.0.113.99"
    );
    expect(otherClient.status).toBe(200);
    expect(await countPngs(root)).toBe(3);
  });

  it("returns 503 when the file-count budget is reached", async () => {
    app = createShareApp({
      storeBudget: { maxFiles: 1, maxBytes: 512 * 1024 * 1024 },
    });
    const repay = await postShare(app, ROUTES[0].path, ROUTES[0].fields, MIN_PNG);
    const borrow = await postShare(app, ROUTES[1].path, ROUTES[1].fields, MIN_PNG);
    expect(repay.status).toBe(200);
    expect(borrow.status).toBe(503);
    expect(await countPngs(root)).toBe(1);
  });

  it("returns 503 when the byte budget is reached", async () => {
    app = createShareApp({
      storeBudget: { maxFiles: 100, maxBytes: MIN_PNG.length },
    });
    const first = await postShare(app, ROUTES[0].path, ROUTES[0].fields, MIN_PNG);
    const second = await postShare(app, ROUTES[2].path, ROUTES[2].fields, MIN_PNG);
    expect(first.status).toBe(200);
    expect(second.status).toBe(503);
    expect(await countPngs(root)).toBe(1);
  });

  it("removes expired files without anyone opening the link", async () => {
    const created: { id: string; expiresAt: number; imagePath: string }[] = [];
    for (const route of ROUTES) {
      const response = await postShare(app, route.path, route.fields, MIN_PNG);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        shareId: string;
        expiresAt: number;
      };
      created.push({
        id: body.shareId,
        expiresAt: body.expiresAt,
        imagePath: route.imagePath(body.shareId),
      });
    }
    expect(await countPngs(root)).toBe(3);
    expect(await sweepAllShareStores(Date.now())).toBe(0);
    expect(await countPngs(root)).toBe(3);

    const later = Math.max(...created.map((item) => item.expiresAt));
    const removed = await sweepAllShareStores(later);
    expect(removed).toBeGreaterThanOrEqual(3);
    expect(await countPngs(root)).toBe(0);
    for (const item of created) {
      const image = await app.request(`http://share.test${item.imagePath}`);
      expect(image.status).toBe(404);
    }
  });

  it("deletes an unindexed PNG that is past the orphan age", async () => {
    const dir = path.join(root, "repay");
    await mkdir(dir, { recursive: true });
    const stale = path.join(dir, "staleorphan.png");
    const fresh = path.join(dir, "freshorphan.png");
    await writeFile(stale, MIN_PNG);
    await writeFile(fresh, MIN_PNG);
    const old = new Date(Date.now() - 60 * 60 * 1000);
    await utimes(stale, old, old);

    const removed = await sweepAllShareStores(Date.now());
    expect(removed).toBe(1);
    await expect(stat(stale)).rejects.toThrow();
    await expect(stat(fresh)).resolves.toBeTruthy();
  });
});
