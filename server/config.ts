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

const APP_FRONTEND_ORIGIN = "https://app.dork.fi";

function resolveFrontendOrigins(): string[] {
  const explicit = process.env.X_SHARE_FRONTEND_ORIGIN?.trim();
  if (explicit) {
    return explicit
      .split(",")
      .map((part) => part.trim().replace(/\/+$/, ""))
      .filter(Boolean);
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return [
      APP_FRONTEND_ORIGIN,
      "https://www.app.dork.fi",
      "https://beta.dork.fi",
    ];
  }
  return ["http://localhost:8080"];
}

/**
 * Human redirects after opening a share permalink always land on app.dork.fi
 * when that origin is allowed (or any dork.fi frontend is configured). CORS
 * still uses the full `frontendOrigins` list so beta can create shares.
 */
function resolveFrontendOrigin(origins: string[]): string {
  if (origins.includes(APP_FRONTEND_ORIGIN)) {
    return APP_FRONTEND_ORIGIN;
  }
  if (origins.some((origin) => /\/\/(?:[\w-]+\.)*dork\.fi$/i.test(origin))) {
    return APP_FRONTEND_ORIGIN;
  }
  return origins[0] ?? APP_FRONTEND_ORIGIN;
}

const frontendOrigins = resolveFrontendOrigins();

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SHARE_TTL_DAYS = 7;

function envPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

/** Read a day-count env var. `fallbackName` is used when `name` is unset. */
function ttlFromEnv(name: string, fallbackName?: string): number {
  if (process.env[name]?.trim()) {
    return envPositiveInt(name, DEFAULT_SHARE_TTL_DAYS) * DAY_MS;
  }
  if (fallbackName && process.env[fallbackName]?.trim()) {
    return envPositiveInt(fallbackName, DEFAULT_SHARE_TTL_DAYS) * DAY_MS;
  }
  return DEFAULT_SHARE_TTL_DAYS * DAY_MS;
}

export const config = {
  port: Number(process.env.PORT || optional("X_SHARE_PORT", "8788")),
  /** Allowed browser origins for CORS (supports comma-separated env). */
  frontendOrigins,
  /** Primary origin for human redirects after opening a share permalink. */
  frontendOrigin: resolveFrontendOrigin(frontendOrigins),
  get repayShareStorePath(): string {
    return optional("X_REPAY_SHARE_STORE_PATH", ".data/repay-shares");
  },
  /** Default 7 days — long enough for X to fetch the card. */
  get repayShareTtlMs(): number {
    return ttlFromEnv("X_REPAY_SHARE_TTL_DAYS");
  },
  get borrowShareStorePath(): string {
    return optional("X_BORROW_SHARE_STORE_PATH", ".data/borrow-shares");
  },
  /** Default 7 days. Falls back to the repay TTL when unset. */
  get borrowShareTtlMs(): number {
    return ttlFromEnv("X_BORROW_SHARE_TTL_DAYS", "X_REPAY_SHARE_TTL_DAYS");
  },
  get profileShareStorePath(): string {
    return optional("X_PROFILE_SHARE_STORE_PATH", ".data/profile-shares");
  },
  /** Default 7 days. Falls back to the repay TTL when unset. */
  get profileShareTtlMs(): number {
    return ttlFromEnv("X_PROFILE_SHARE_TTL_DAYS", "X_REPAY_SHARE_TTL_DAYS");
  },
  /** Refuse new share images once this many PNGs are stored. */
  get shareStoreMaxFiles(): number {
    return envPositiveInt("X_SHARE_STORE_MAX_FILES", 2000);
  },
  /** Refuse new share images once stored PNG bytes reach this budget. */
  get shareStoreMaxBytes(): number {
    return envPositiveInt("X_SHARE_STORE_MAX_BYTES", 512 * 1024 * 1024);
  },
  sharePublicBase: resolveSharePublicBase(),
  isProduction: process.env.NODE_ENV === "production",
};
