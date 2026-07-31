function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

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

function resolveFrontendOrigins(): string[] {
  const explicit = process.env.X_SHARE_FRONTEND_ORIGIN?.trim();
  if (explicit) {
    return explicit
      .split(",")
      .map((part) => part.trim().replace(/\/+$/, ""))
      .filter(Boolean);
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return ["https://app.dork.fi", "https://beta.dork.fi"];
  }
  return ["http://localhost:8080"];
}

const frontendOrigins = resolveFrontendOrigins();

export const config = {
  port: Number(process.env.PORT || optional("X_SHARE_PORT", "8788")),
  /** Allowed browser origins for CORS (supports comma-separated env). */
  frontendOrigins,
  /** Primary origin for human redirects after opening a share permalink. */
  frontendOrigin: frontendOrigins[0] ?? "https://app.dork.fi",
  repayShareStorePath: optional(
    "X_REPAY_SHARE_STORE_PATH",
    ".data/repay-shares"
  ),
  /** Default 90 days. */
  repayShareTtlMs:
    Number(optional("X_REPAY_SHARE_TTL_DAYS", "90")) * 24 * 60 * 60 * 1000,
  borrowShareStorePath: optional(
    "X_BORROW_SHARE_STORE_PATH",
    ".data/borrow-shares"
  ),
  /** Default 90 days (falls back to repay TTL env when unset). */
  borrowShareTtlMs:
    Number(
      optional(
        "X_BORROW_SHARE_TTL_DAYS",
        optional("X_REPAY_SHARE_TTL_DAYS", "90")
      )
    ) *
    24 *
    60 *
    60 *
    1000,
  sharePublicBase: resolveSharePublicBase(),
  isProduction: process.env.NODE_ENV === "production",
};
