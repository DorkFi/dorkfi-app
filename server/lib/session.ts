import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

const SESSION_COOKIE = "dorkfi_x_share_session";

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function createSessionId(): string {
  return randomBytes(24).toString("hex");
}

function sign(value: string): string {
  return createHmac("sha256", config.sessionSecret).update(value).digest("hex");
}

export function sealSessionId(sessionId: string): string {
  const signature = sign(sessionId);
  return `${sessionId}.${signature}`;
}

export function openSessionId(sealed: string | undefined): string | null {
  if (!sealed) return null;
  const [sessionId, signature] = sealed.split(".");
  if (!sessionId || !signature) return null;

  const expected = sign(sessionId);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  return sessionId;
}

export function getCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
