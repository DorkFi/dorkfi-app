/**
 * Coinbase redirectUrl must be on the CDP domain allowlist.
 * Never fall back to localhost when the request has a real origin.
 */

function originFromUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function requestSiteOrigin(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const originHeader = req.headers.origin;
  if (typeof originHeader === "string" && originHeader.trim()) {
    return originFromUrl(originHeader.trim());
  }
  const hostRaw = req.headers.host;
  const host = typeof hostRaw === "string" ? hostRaw.trim() : "";
  if (!host) return null;
  const xf = req.headers["x-forwarded-proto"];
  const protoRaw = Array.isArray(xf) ? xf[0] : xf;
  const proto = (protoRaw?.split(",")[0]?.trim() || "https").replace(/:$/, "");
  return originFromUrl(`${proto}://${host}`);
}

function configuredRedirect(
  env: Record<string, string | undefined>
): string | null {
  const raw =
    env.OFFRAMP_REDIRECT_URL?.trim() || env.VITE_OFFRAMP_REDIRECT_URL?.trim();
  if (!raw || !originFromUrl(raw)) return null;
  return raw.replace(/\/+$/, "");
}

export function isAllowedRedirectUrl(
  candidate: string,
  allowedOrigins: string[]
): boolean {
  const origin = originFromUrl(candidate);
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

export function resolveCoinbaseRedirectUrl(
  req: { headers: Record<string, string | string[] | undefined> },
  requested: string | undefined,
  env: Record<string, string | undefined> = process.env
): string {
  const site = requestSiteOrigin(req);
  const configured = configuredRedirect(env);
  const allowed = [
    ...new Set(
      [site, configured ? originFromUrl(configured) : null].filter(
        (v): v is string => Boolean(v)
      )
    ),
  ];

  const requestedTrim = requested?.trim();
  if (requestedTrim && isAllowedRedirectUrl(requestedTrim, allowed)) {
    return requestedTrim;
  }
  if (configured && (!site || originFromUrl(configured) === site)) {
    return configured;
  }
  if (site) return `${site}/portfolio`;
  if (configured) return configured;
  return "http://localhost:5173/portfolio";
}
