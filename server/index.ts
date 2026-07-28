import "./loadEnv.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import { config, isXApiConfigured } from "./config.js";
import { createPkcePair, randomUrlSafeString } from "./lib/pkce.js";
import {
  clearSessionTokens,
  consumePendingOAuth,
  getSessionTokens,
  setPendingOAuth,
  setSessionTokens,
} from "./lib/tokenStore.js";
import {
  buildXAuthorizeUrl,
  createTweetWithMedia,
  ensureFreshAccessToken,
  exchangeAuthorizationCode,
  uploadTweetImage,
} from "./lib/xApi.js";
import {
  createSessionId,
  getCookieOptions,
  getSessionCookieName,
  openSessionId,
  sealSessionId,
} from "./lib/session.js";
import {
  createGovernanceShare,
  getGovernanceShare,
  getGovernanceShareImage,
} from "./lib/governanceShareStore.js";
import {
  buildGovernanceRedirectUrl,
  buildGovernanceShareOgHtml,
  buildSharePublicUrls,
} from "./lib/governanceSharePage.js";
import { isSocialCrawler } from "./lib/isSocialCrawler.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: config.frontendOrigin,
    credentials: true,
  })
);

function resolveSessionId(c: Parameters<typeof getCookie>[0]): string {
  const sealed = getCookie(c, getSessionCookieName());
  const existing = openSessionId(sealed);
  if (existing) return existing;

  const sessionId = createSessionId();
  setCookie(c, getSessionCookieName(), sealSessionId(sessionId), getCookieOptions());
  return sessionId;
}

function sanitizeReturnTo(returnTo: string | undefined): string {
  if (!returnTo || !returnTo.startsWith("/")) {
    return "/governance";
  }
  return returnTo;
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    xApiConfigured: isXApiConfigured(),
    linkShareEnabled: true,
    sharePublicBase: config.sharePublicBase,
  })
);

app.get("/auth/x/status", async (c) => {
  const sessionId = resolveSessionId(c);
  const tokens = await getSessionTokens(sessionId);
  if (!tokens) {
    return c.json({
      connected: false,
      configured: isXApiConfigured(),
      linkShareEnabled: true,
    });
  }

  return c.json({
    connected: true,
    configured: true,
    linkShareEnabled: true,
    username: tokens.username ? `@${tokens.username}` : undefined,
    userId: tokens.userId,
  });
});

app.get("/auth/x/start", (c) => {
  if (!isXApiConfigured()) {
    return c.json({ error: "X API is not configured on the server" }, 503);
  }

  const sessionId = resolveSessionId(c);
  const returnTo = sanitizeReturnTo(c.req.query("returnTo"));
  const { verifier, challenge } = createPkcePair();
  const state = randomUrlSafeString(24);

  setPendingOAuth(state, {
    codeVerifier: verifier,
    returnTo,
  });

  setCookie(c, getSessionCookieName(), sealSessionId(sessionId), getCookieOptions());

  const authorizeUrl = buildXAuthorizeUrl({
    state,
    codeChallenge: challenge,
  });

  return c.redirect(authorizeUrl, 302);
});

app.get("/auth/x/callback", async (c) => {
  if (!isXApiConfigured()) {
    return c.text("X API is not configured", 503);
  }

  const error = c.req.query("error");
  if (error) {
    const returnTo = sanitizeReturnTo(consumePendingOAuth(c.req.query("state") ?? "")?.returnTo);
    const redirect = new URL(returnTo, config.frontendOrigin);
    redirect.searchParams.set("x_error", error);
    return c.redirect(redirect.toString(), 302);
  }

  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) {
    return c.text("Missing OAuth code or state", 400);
  }

  const pending = consumePendingOAuth(state);
  if (!pending) {
    return c.text("OAuth state expired or invalid", 400);
  }

  const sessionId = resolveSessionId(c);

  try {
    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: pending.codeVerifier,
    });
    await setSessionTokens(sessionId, tokens);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth exchange failed";
    const redirect = new URL(pending.returnTo, config.frontendOrigin);
    redirect.searchParams.set("x_error", message);
    return c.redirect(redirect.toString(), 302);
  }

  const redirect = new URL(pending.returnTo, config.frontendOrigin);
  redirect.searchParams.set("x_connected", "1");
  return c.redirect(redirect.toString(), 302);
});

app.post("/auth/x/disconnect", async (c) => {
  const sessionId = resolveSessionId(c);
  await clearSessionTokens(sessionId);
  return c.json({ connected: false });
});

app.post("/share/governance-vote/link", async (c) => {
  const form = await c.req.parseBody();
  const image = form.image;
  const proposalId =
    typeof form.proposalId === "string" ? form.proposalId.trim() : "";
  const proposalTitle =
    typeof form.proposalTitle === "string" ? form.proposalTitle.trim() : "";
  const supportRaw = form.support;
  const votingPowerRaw = form.votingPower;

  if (!(image instanceof File)) {
    return c.json({ error: "Missing image file" }, 400);
  }
  if (!proposalId) {
    return c.json({ error: "Missing proposalId" }, 400);
  }
  if (!proposalTitle) {
    return c.json({ error: "Missing proposalTitle" }, 400);
  }

  const support =
    supportRaw === "true" || supportRaw === true
      ? true
      : supportRaw === "false" || supportRaw === false
        ? false
        : null;
  if (support === null) {
    return c.json({ error: "Missing or invalid support flag" }, 400);
  }

  const votingPower = Number(votingPowerRaw);
  if (!Number.isFinite(votingPower) || votingPower < 0) {
    return c.json({ error: "Missing or invalid votingPower" }, 400);
  }

  try {
    const buffer = Buffer.from(await image.arrayBuffer());
    const record = await createGovernanceShare({
      proposalId,
      proposalTitle,
      support,
      votingPower,
      imageBuffer: buffer,
    });
    const urls = buildSharePublicUrls(record.id);

    return c.json({
      ok: true,
      shareId: record.id,
      shareUrl: urls.shareUrl,
      imageUrl: urls.imageUrl,
      expiresAt: record.expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create share link";
    return c.json({ error: message }, 502);
  }
});

app.get("/gov/:id/image.png", async (c) => {
  const id = c.req.param("id");
  const result = await getGovernanceShareImage(id);
  if (!result) {
    return c.text("Share not found", 404);
  }

  return new Response(result.buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
});

app.get("/gov/:id", async (c) => {
  const id = c.req.param("id");
  const record = await getGovernanceShare(id);
  if (!record) {
    return c.text("Share not found", 404);
  }

  const userAgent = c.req.header("user-agent");
  if (!isSocialCrawler(userAgent)) {
    return c.redirect(buildGovernanceRedirectUrl(record), 302);
  }

  const urls = buildSharePublicUrls(record.id);
  const html = buildGovernanceShareOgHtml({
    record,
    shareUrl: urls.shareUrl,
    imageUrl: urls.imageUrl,
  });

  return c.html(html);
});

app.post("/share/governance-vote", async (c) => {
  if (!isXApiConfigured()) {
    return c.json({ error: "X API is not configured on the server" }, 503);
  }

  const sessionId = resolveSessionId(c);
  const stored = await getSessionTokens(sessionId);
  if (!stored) {
    return c.json({ error: "Connect your X account before sharing" }, 401);
  }

  const form = await c.req.parseBody();
  const image = form.image;
  const text = typeof form.text === "string" ? form.text : "";

  if (!(image instanceof File)) {
    return c.json({ error: "Missing image file" }, 400);
  }

  if (!text.trim()) {
    return c.json({ error: "Missing tweet text" }, 400);
  }

  try {
    const tokens = await ensureFreshAccessToken(stored);
    if (tokens.accessToken !== stored.accessToken) {
      await setSessionTokens(sessionId, tokens);
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const mediaId = await uploadTweetImage(tokens.accessToken, buffer);
    const tweet = await createTweetWithMedia({
      accessToken: tokens.accessToken,
      text: text.trim(),
      mediaId,
    });

    return c.json({
      ok: true,
      tweetId: tweet.tweetId,
      tweetUrl: tweet.tweetUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to post to X";
    return c.json({ error: message }, 502);
  }
});

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(
      `X share server listening on http://127.0.0.1:${info.port} (xApiConfigured=${isXApiConfigured()})`
    );
    console.log(`OAuth callback URL (register in X Developer Portal): ${config.callbackUrl}`);
    console.log(`Frontend origin: ${config.frontendOrigin}`);
  }
);
