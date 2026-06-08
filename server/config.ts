function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

/** Default: Vite proxy on localhost:8080 so OAuth cookies stay on one origin. */
const DEFAULT_DEV_CALLBACK_URL =
  "http://localhost:8080/api/x-share/auth/x/callback";

const DEFAULT_DEV_SHARE_PUBLIC_BASE = "http://localhost:8080/api/x-share";

function resolveSharePublicBase(): string {
  const explicit = process.env.X_SHARE_PUBLIC_BASE?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) {
    return `https://${railwayDomain.replace(/\/+$/, "")}`;
  }

  return DEFAULT_DEV_SHARE_PUBLIC_BASE;
}

export const config = {
  port: Number(process.env.PORT || optional("X_SHARE_PORT", "8788")),
  frontendOrigin: optional(
    "X_SHARE_FRONTEND_ORIGIN",
    process.env.RAILWAY_PUBLIC_DOMAIN ? "https://app.dork.fi" : "http://localhost:8080"
  ),
  callbackUrl: optional("X_CALLBACK_URL", DEFAULT_DEV_CALLBACK_URL),
  sessionSecret: optional(
    "X_SHARE_SESSION_SECRET",
    "dev-only-change-me-in-production"
  ),
  tokenStorePath: optional(
    "X_TOKEN_STORE_PATH",
    ".data/x-share-tokens.json"
  ),
  governanceShareStorePath: optional(
    "X_GOVERNANCE_SHARE_STORE_PATH",
    ".data/governance-shares"
  ),
  /** Default 90 days. */
  governanceShareTtlMs:
    Number(optional("X_GOVERNANCE_SHARE_TTL_DAYS", "90")) * 24 * 60 * 60 * 1000,
  /** Public base URL for share permalinks (used in tweets and og:image). */
  sharePublicBase: resolveSharePublicBase(),
  xClientId: process.env.X_CLIENT_ID?.trim() ?? "",
  xClientSecret: process.env.X_CLIENT_SECRET?.trim() ?? "",
  isProduction: process.env.NODE_ENV === "production",
};

export function isXApiConfigured(): boolean {
  return Boolean(config.xClientId && config.xClientSecret);
}

export function assertXApiConfigured(): void {
  if (!isXApiConfigured()) {
    throw new Error(
      "X API is not configured. Set X_CLIENT_ID and X_CLIENT_SECRET."
    );
  }
}
