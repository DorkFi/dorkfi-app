import "./loadEnv.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
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

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.frontendOrigins,
    // Share link flows do not use cookies; keep CORS simple for beta/app.
    credentials: false,
  })
);

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

app.post("/share/repay-confirmation/link", async (c) => {
  const form = await c.req.parseBody();
  const image = form.image;
  const amount = typeof form.amount === "string" ? form.amount.trim() : "";
  const assetSymbol =
    typeof form.assetSymbol === "string" ? form.assetSymbol.trim() : "";
  const paidWithSymbol =
    typeof form.paidWithSymbol === "string"
      ? form.paidWithSymbol.trim()
      : undefined;
  const network =
    typeof form.network === "string" ? form.network.trim() : undefined;

  if (!(image instanceof File)) {
    return c.json({ error: "Missing image file" }, 400);
  }
  if (!assetSymbol) {
    return c.json({ error: "Missing assetSymbol" }, 400);
  }

  try {
    const buffer = Buffer.from(await image.arrayBuffer());
    const record = await createRepayShare({
      amount: amount || "0",
      assetSymbol,
      paidWithSymbol: paidWithSymbol || undefined,
      network: network || undefined,
      imageBuffer: buffer,
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
    const message =
      err instanceof Error ? err.message : "Failed to create repay share link";
    return c.json({ error: message }, 502);
  }
});

app.post("/share/borrow-confirmation/link", async (c) => {
  const form = await c.req.parseBody();
  const image = form.image;
  const amount = typeof form.amount === "string" ? form.amount.trim() : "";
  const assetSymbol =
    typeof form.assetSymbol === "string" ? form.assetSymbol.trim() : "";
  const network =
    typeof form.network === "string" ? form.network.trim() : undefined;

  if (!(image instanceof File)) {
    return c.json({ error: "Missing image file" }, 400);
  }
  if (!assetSymbol) {
    return c.json({ error: "Missing assetSymbol" }, 400);
  }

  try {
    const buffer = Buffer.from(await image.arrayBuffer());
    const record = await createBorrowShare({
      amount: amount || "0",
      assetSymbol,
      network: network || undefined,
      imageBuffer: buffer,
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
    const message =
      err instanceof Error ? err.message : "Failed to create borrow share link";
    return c.json({ error: message }, 502);
  }
});

app.get("/repay/:id/image.png", async (c) => {
  const id = c.req.param("id");
  const result = await getRepayShareImage(id);
  if (!result) {
    return c.text("Share not found", 404);
  }

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
});

app.get("/repay/:id", async (c) => {
  const id = c.req.param("id");
  const record = await getRepayShare(id);
  if (!record) {
    return c.text("Share not found", 404);
  }

  const userAgent = c.req.header("user-agent");
  if (!isSocialCrawler(userAgent)) {
    return c.redirect(buildRepayRedirectUrl(), 302);
  }

  const urls = buildRepaySharePublicUrls(record.id);
  const html = buildRepayShareOgHtml({
    record,
    shareUrl: urls.shareUrl,
    imageUrl: urls.imageUrl,
  });

  return c.html(html);
});

app.get("/borrow/:id/image.png", async (c) => {
  const id = c.req.param("id");
  const result = await getBorrowShareImage(id);
  if (!result) {
    return c.text("Share not found", 404);
  }

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
});

app.get("/borrow/:id", async (c) => {
  const id = c.req.param("id");
  const record = await getBorrowShare(id);
  if (!record) {
    return c.text("Share not found", 404);
  }

  const userAgent = c.req.header("user-agent");
  if (!isSocialCrawler(userAgent)) {
    return c.redirect(buildBorrowRedirectUrl(), 302);
  }

  const urls = buildBorrowSharePublicUrls(record.id);
  const html = buildBorrowShareOgHtml({
    record,
    shareUrl: urls.shareUrl,
    imageUrl: urls.imageUrl,
  });

  return c.html(html);
});

app.post("/share/profile-update/link", async (c) => {
  const form = await c.req.parseBody();
  const image = form.image;
  const nftName = typeof form.nftName === "string" ? form.nftName.trim() : "";
  const collectionId =
    typeof form.collectionId === "string" ? form.collectionId.trim() : undefined;
  const contractIdRaw =
    typeof form.contractId === "string" ? form.contractId.trim() : "";
  const contractId = contractIdRaw ? Number(contractIdRaw) : undefined;

  if (!(image instanceof File)) {
    return c.json({ error: "Missing image file" }, 400);
  }
  if (!nftName) {
    return c.json({ error: "Missing nftName" }, 400);
  }

  try {
    const buffer = Buffer.from(await image.arrayBuffer());
    const record = await createProfileShare({
      nftName,
      contractId:
        contractId !== undefined && Number.isFinite(contractId)
          ? contractId
          : undefined,
      collectionId: collectionId || undefined,
      imageBuffer: buffer,
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
    const message =
      err instanceof Error
        ? err.message
        : "Failed to create profile share link";
    return c.json({ error: message }, 502);
  }
});

app.get("/profile/:id/image.png", async (c) => {
  const id = c.req.param("id");
  const result = await getProfileShareImage(id);
  if (!result) {
    return c.text("Share not found", 404);
  }

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
});

app.get("/profile/:id", async (c) => {
  const id = c.req.param("id");
  const record = await getProfileShare(id);
  if (!record) {
    return c.text("Share not found", 404);
  }

  const userAgent = c.req.header("user-agent");
  if (!isSocialCrawler(userAgent)) {
    return c.redirect(buildProfileRedirectUrl(), 302);
  }

  const urls = buildProfileSharePublicUrls(record.id);
  const html = buildProfileShareOgHtml({
    record,
    shareUrl: urls.shareUrl,
    imageUrl: urls.imageUrl,
  });

  return c.html(html);
});

console.log(
  `[share-server] listening on :${config.port} (public base ${config.sharePublicBase})`
);

serve({
  fetch: app.fetch,
  port: config.port,
});
