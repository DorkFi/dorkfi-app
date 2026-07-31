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

console.log(
  `[share-server] listening on :${config.port} (public base ${config.sharePublicBase})`
);

serve({
  fetch: app.fetch,
  port: config.port,
});
