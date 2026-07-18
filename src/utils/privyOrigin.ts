/** Privy dashboard allowlist for DorkFi (keep in sync with dashboard). */
export const PRIVY_ALLOWED_ORIGINS = [
  "https://app.dork.fi",
  "https://www.app.dork.fi",
  "https://beta.dork.fi",
  "http://localhost:8080",
] as const;

/** Origins where Easy Start is on without `VITE_ENABLE_PRIVY_ONBOARDING`. */
export const PRIVY_AUTO_ENABLE_ORIGINS = ["https://beta.dork.fi"] as const;

/**
 * Public Privy app id (client-safe). Override with `VITE_PRIVY_APP_ID` when needed.
 * Baked in so beta/production builds still work if the host omits the env var.
 */
export const DEFAULT_PRIVY_APP_ID = "cmrfehwv300ix0ci8uh0tnm8q";

const LOCAL_PRIVY_ORIGIN = "http://localhost:8080";

export function getPrivyAppId(): string {
  const fromEnv = (import.meta.env.VITE_PRIVY_APP_ID ?? "").trim();
  return fromEnv || DEFAULT_PRIVY_APP_ID;
}

/**
 * Whether Easy Start should mount.
 * - `VITE_ENABLE_PRIVY_ONBOARDING=false|0` always disables
 * - `true|1` always enables
 * - DEV defaults on
 * - `beta.dork.fi` auto-enables for testing without host env
 * - otherwise uses the config feature flag (default off)
 */
export function resolvePrivyOnboardingEnabled(
  configFeatureEnabled: boolean,
  origin = typeof window !== "undefined" ? window.location.origin : ""
): boolean {
  const flag = import.meta.env.VITE_ENABLE_PRIVY_ONBOARDING;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  if (import.meta.env.DEV) return true;
  if (
    (PRIVY_AUTO_ENABLE_ORIGINS as readonly string[]).includes(origin)
  ) {
    return true;
  }
  return configFeatureEnabled;
}

export function isPrivyOriginAllowed(origin = window.location.origin): boolean {
  return (PRIVY_ALLOWED_ORIGINS as readonly string[]).includes(origin);
}

/** Actionable hint when the current URL cannot initialize Privy. */
export function getPrivyOriginHint(origin = window.location.origin): string | null {
  if (isPrivyOriginAllowed(origin)) return null;

  if (import.meta.env.DEV) {
    if (origin === "http://localhost:8081") {
      return `Privy only allowlists port 8080 locally. Open ${LOCAL_PRIVY_ORIGIN} (not :8081).`;
    }
    if (
      origin.startsWith("http://127.0.0.1:") ||
      origin.startsWith("http://[::1]:")
    ) {
      return `Privy allowlists localhost, not the numeric IP. Open ${LOCAL_PRIVY_ORIGIN}.`;
    }
    if (origin.startsWith("http://10.") || origin.startsWith("http://192.168.")) {
      return `LAN URLs are not allowlisted. On this machine use ${LOCAL_PRIVY_ORIGIN}.`;
    }
  }

  return `Add ${origin} to Allowed origins in the Privy dashboard, then hard-refresh.`;
}
