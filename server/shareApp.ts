import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { handleHonoOfframp } from "./offramp/honoAdapter.js";
import { isSocialCrawler } from "./lib/isSocialCrawler.js";
import {
  buildBorrowRedirectUrl,
  buildBorrowShareOgHtml,
  buildBorrowSharePublicUrls,
} from "./lib/borrowSharePage.js";
import {
  createBorrowShare,
  getBorrowShare,
  getBorrowShareImage,
} from "./lib/borrowShareStore.js";
import {
  buildRepayRedirectUrl,
  buildRepayShareOgHtml,
  buildRepaySharePublicUrls,
} from "./lib/repaySharePage.js";
import {
  createRepayShare,
  getRepayShare,
  getRepayShareImage,
} from "./lib/repayShareStore.js";
import {
  buildProfileRedirectUrl,
  buildProfileShareOgHtml,
  buildProfileSharePublicUrls,
} from "./lib/profileSharePage.js";
import {
  createProfileShare,
  getProfileShare,
  getProfileShareImage,
} from "./lib/profileShareStore.js";
import {
  contentTypeForImageUrl,
  isAllowedImageProxyUrl,
} from "./lib/imageProxy.js";
import { createRateLimiter } from "./sponsor/rateLimit.js";
import {
  assertShareStoreHasRoom,
  ShareStoreFullError,
  type ShareStoreBudget,
  withShareWriteLock,
} from "./lib/shareDisk.js";
import {
  readShareField,
  readShareImage,
  SHARE_CREATE_RATE_MAX,
  SHARE_CREATE_RATE_WINDOW_MS,
  SHARE_MAX_BODY_BYTES,
  shareClientIpFromHeaders,
} from "./lib/shareUpload.js";

export type ShareAppOptions = {
  rateLimit?: { max: number; windowMs: number };
  storeBudget?: ShareStoreBudget;
};

function shareClientIp(c: Context): string {
  return shareClientIpFromHeaders({
    "x-real-ip": c.req.header("x-real-ip"),
  });
}

function pngResponse(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function fieldOr400(
  c: Context,
  value: unknown,
  name: string,
  required = false
): { ok: true; value: string } | { ok: false; response: Response } {
  const read = readShareField(value, name, { required });
  if (!read.ok) {
    return { ok: false, response: c.json({ error: read.error }, 400) };
  }
  return { ok: true, value: read.value };
}

function shareWriteError(c: Context, err: unknown, fallback: string): Response {
  if (err instanceof ShareStoreFullError) {
    return c.json({ error: "Share store is full" }, 503);
  }
  const message = err instanceof Error ? err.message : fallback;
  return c.json({ error: message }, 502);
}

export function createShareApp(options: ShareAppOptions = {}): Hono {
  const app = new Hono();
  const limiter = createRateLimiter(
    options.rateLimit ?? {
      max: SHARE_CREATE_RATE_MAX,
      windowMs: SHARE_CREATE_RATE_WINDOW_MS,
    }
  );
  const budget = options.storeBudget;

  const limitCreates: MiddlewareHandler = async (c, next) => {
    if (!limiter.allow(shareClientIp(c))) {
      return c.json({ error: "Too many share uploads" }, 429);
    }
    await next();
  };

  const limitBody = bodyLimit({
    maxSize: SHARE_MAX_BODY_BYTES,
    onError: (c) => c.json({ error: "Payload too large" }, 413),
  });

  app.use(
    "*",
    cors({
      origin: config.frontendOrigins,
      // Share link flows do not use cookies; keep CORS simple for beta/app.
      credentials: false,
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.all("/api/offramp/*", (c) => handleHonoOfframp(c));

  app.get("/health", (c) =>
    c.json({
      ok: true,
      linkShareEnabled: true,
      sharePublicBase: config.sharePublicBase,
      frontendOrigins: config.frontendOrigins,
    })
  );

  /**
   * Proxies allowlisted NFT CDN images so the browser canvas can draw them
   * with CORS (Highforge does not send Access-Control-Allow-Origin).
   */
  app.get("/share/image-proxy", async (c) => {
    const raw = c.req.query("url")?.trim() || "";
    if (!raw || !isAllowedImageProxyUrl(raw)) {
      return c.json({ error: "URL not allowed" }, 400);
    }

    try {
      const upstream = await fetch(raw, {
        headers: { Accept: "image/*,*/*" },
      });
      if (!upstream.ok) {
        return c.json(
          { error: `Upstream image failed (${upstream.status})` },
          502
        );
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      const upstreamType = upstream.headers.get("content-type") || "";
      const contentType = contentTypeForImageUrl(raw, upstreamType);

      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
          // Explicit for canvas consumers behind the Vite proxy.
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to proxy image";
      return c.json({ error: message }, 502);
    }
  });

  app.post(
    "/share/repay-confirmation/link",
    limitCreates,
    limitBody,
    async (c) => {
      const form = await c.req.parseBody();
      const image = await readShareImage(form.image);
      if (!image.ok) return c.json({ error: image.error }, image.status);

      const amount = fieldOr400(c, form.amount, "amount");
      if (!amount.ok) return amount.response;
      const assetSymbol = fieldOr400(c, form.assetSymbol, "assetSymbol", true);
      if (!assetSymbol.ok) return assetSymbol.response;
      const paidWithSymbol = fieldOr400(c, form.paidWithSymbol, "paidWithSymbol");
      if (!paidWithSymbol.ok) return paidWithSymbol.response;
      const network = fieldOr400(c, form.network, "network");
      if (!network.ok) return network.response;

      try {
        const record = await withShareWriteLock(async () => {
          await assertShareStoreHasRoom(image.buffer.length, budget);
          return createRepayShare({
            amount: amount.value || "0",
            assetSymbol: assetSymbol.value,
            paidWithSymbol: paidWithSymbol.value || undefined,
            network: network.value || undefined,
            imageBuffer: image.buffer,
          });
        });
        const urls = buildRepaySharePublicUrls(record.id);
        return c.json({
          ok: true,
          shareId: record.id,
          shareUrl: urls.shareUrl,
          imageUrl: urls.imageUrl,
          expiresAt: record.expiresAt,
        });
      } catch (err) {
        return shareWriteError(c, err, "Failed to create repay share link");
      }
    }
  );

  app.post(
    "/share/borrow-confirmation/link",
    limitCreates,
    limitBody,
    async (c) => {
      const form = await c.req.parseBody();
      const image = await readShareImage(form.image);
      if (!image.ok) return c.json({ error: image.error }, image.status);

      const amount = fieldOr400(c, form.amount, "amount");
      if (!amount.ok) return amount.response;
      const assetSymbol = fieldOr400(c, form.assetSymbol, "assetSymbol", true);
      if (!assetSymbol.ok) return assetSymbol.response;
      const network = fieldOr400(c, form.network, "network");
      if (!network.ok) return network.response;

      try {
        const record = await withShareWriteLock(async () => {
          await assertShareStoreHasRoom(image.buffer.length, budget);
          return createBorrowShare({
            amount: amount.value || "0",
            assetSymbol: assetSymbol.value,
            network: network.value || undefined,
            imageBuffer: image.buffer,
          });
        });
        const urls = buildBorrowSharePublicUrls(record.id);
        return c.json({
          ok: true,
          shareId: record.id,
          shareUrl: urls.shareUrl,
          imageUrl: urls.imageUrl,
          expiresAt: record.expiresAt,
        });
      } catch (err) {
        return shareWriteError(c, err, "Failed to create borrow share link");
      }
    }
  );

  app.get("/repay/:id/image.png", async (c) => {
    const id = c.req.param("id");
    const result = await getRepayShareImage(id);
    if (!result) return c.text("Share not found", 404);
    return pngResponse(result.buffer);
  });

  app.get("/repay/:id", async (c) => {
    const id = c.req.param("id");
    const record = await getRepayShare(id);
    if (!record) return c.text("Share not found", 404);

    const userAgent = c.req.header("user-agent");
    if (!isSocialCrawler(userAgent)) {
      return c.redirect(buildRepayRedirectUrl(), 302);
    }

    const urls = buildRepaySharePublicUrls(record.id);
    return c.html(
      buildRepayShareOgHtml({
        record,
        shareUrl: urls.shareUrl,
        imageUrl: urls.imageUrl,
      })
    );
  });

  app.get("/borrow/:id/image.png", async (c) => {
    const id = c.req.param("id");
    const result = await getBorrowShareImage(id);
    if (!result) return c.text("Share not found", 404);
    return pngResponse(result.buffer);
  });

  app.get("/borrow/:id", async (c) => {
    const id = c.req.param("id");
    const record = await getBorrowShare(id);
    if (!record) return c.text("Share not found", 404);

    const userAgent = c.req.header("user-agent");
    if (!isSocialCrawler(userAgent)) {
      return c.redirect(buildBorrowRedirectUrl(), 302);
    }

    const urls = buildBorrowSharePublicUrls(record.id);
    return c.html(
      buildBorrowShareOgHtml({
        record,
        shareUrl: urls.shareUrl,
        imageUrl: urls.imageUrl,
      })
    );
  });

  app.post(
    "/share/profile-update/link",
    limitCreates,
    limitBody,
    async (c) => {
      const form = await c.req.parseBody();
      const image = await readShareImage(form.image);
      if (!image.ok) return c.json({ error: image.error }, image.status);

      const nftName = fieldOr400(c, form.nftName, "nftName", true);
      if (!nftName.ok) return nftName.response;
      const collectionId = fieldOr400(c, form.collectionId, "collectionId");
      if (!collectionId.ok) return collectionId.response;
      const contractIdRaw = fieldOr400(c, form.contractId, "contractId");
      if (!contractIdRaw.ok) return contractIdRaw.response;
      const contractId = contractIdRaw.value
        ? Number(contractIdRaw.value)
        : undefined;

      try {
        const record = await withShareWriteLock(async () => {
          await assertShareStoreHasRoom(image.buffer.length, budget);
          return createProfileShare({
            nftName: nftName.value,
            contractId:
              contractId !== undefined && Number.isFinite(contractId)
                ? contractId
                : undefined,
            collectionId: collectionId.value || undefined,
            imageBuffer: image.buffer,
          });
        });
        const urls = buildProfileSharePublicUrls(record.id);
        return c.json({
          ok: true,
          shareId: record.id,
          shareUrl: urls.shareUrl,
          imageUrl: urls.imageUrl,
          expiresAt: record.expiresAt,
        });
      } catch (err) {
        return shareWriteError(c, err, "Failed to create profile share link");
      }
    }
  );

  app.get("/profile/:id/image.png", async (c) => {
    const id = c.req.param("id");
    const result = await getProfileShareImage(id);
    if (!result) return c.text("Share not found", 404);
    return pngResponse(result.buffer);
  });

  app.get("/profile/:id", async (c) => {
    const id = c.req.param("id");
    const record = await getProfileShare(id);
    if (!record) return c.text("Share not found", 404);

    const userAgent = c.req.header("user-agent");
    if (!isSocialCrawler(userAgent)) {
      return c.redirect(buildProfileRedirectUrl(), 302);
    }

    const urls = buildProfileSharePublicUrls(record.id);
    return c.html(
      buildProfileShareOgHtml({
        record,
        shareUrl: urls.shareUrl,
        imageUrl: urls.imageUrl,
      })
    );
  });

  return app;
}
