/** Privy dashboard allowlist for DorkFi (keep in sync with dashboard). */
export const PRIVY_ALLOWED_ORIGINS = [
  "https://app.dork.fi",
  "https://www.app.dork.fi",
  "http://localhost:8080",
] as const;

const LOCAL_PRIVY_ORIGIN = "http://localhost:8080";

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
