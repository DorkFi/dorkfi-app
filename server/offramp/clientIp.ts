/**
 * End-user IP for CDP session tokens.
 * CDP: do not trust X-Forwarded-For (easy to spoof). Never take IP from the JSON body.
 *
 * Prefer single-value headers set by the edge (Cloudflare / Railway / nginx),
 * then the TCP peer.
 */
const HEADER_ORDER = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
] as const;

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return undefined;
}

function firstIp(raw: string): string {
  return raw.split(",")[0]!.trim();
}

export function endUserIp(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  for (const name of HEADER_ORDER) {
    const raw = headerValue(req.headers, name);
    if (raw) return firstIp(raw);
  }
  const peer = req.socket?.remoteAddress?.replace(/^::ffff:/, "").trim();
  if (peer && peer !== "::1") return peer;
  if (peer === "::1") return "127.0.0.1";
  return "127.0.0.1";
}

/** Loopback, RFC1918, link-local, and CGNAT. Coinbase rejects these as clientIp. */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase().replace(/^::ffff:/, "");
  if (
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

let cachedPublicIp: { value: string; expiresAt: number } | null = null;

async function lookupPublicIp(): Promise<string | null> {
  if (cachedPublicIp && cachedPublicIp.expiresAt > Date.now()) {
    return cachedPublicIp.value;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch("https://api.ipify.org", { signal: controller.signal });
    const text = (await res.text()).trim();
    if (!res.ok || !text || isPrivateOrLoopbackIp(text)) return null;
    cachedPublicIp = { value: text, expiresAt: Date.now() + 10 * 60 * 1000 };
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * IP sent to Coinbase. A public edge or peer address is used as-is.
 * Localhost has only a loopback address, which Coinbase rejects, so dev
 * substitutes CDP_CLIENT_IP or this machine's public address.
 */
export async function coinbaseClientIp(
  req: {
    headers: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
  },
  options?: {
    override?: string;
    allowPublicLookup?: boolean;
    lookupPublicIp?: () => Promise<string | null>;
  }
): Promise<string> {
  const detected = endUserIp(req);
  if (!isPrivateOrLoopbackIp(detected)) return detected;
  const override = options?.override?.trim();
  if (override && !isPrivateOrLoopbackIp(override)) return override;
  if (options?.allowPublicLookup === false) return detected;
  const lookedUp = await (options?.lookupPublicIp ?? lookupPublicIp)();
  return lookedUp && !isPrivateOrLoopbackIp(lookedUp) ? lookedUp : detected;
}

/** Stable CDP partnerUserRef from a Privy user id (max 50 chars). */
export function partnerUserRefFromUserId(userId: string): string {
  const compact = userId.replace(/^did:privy:/, "privy-").replace(/[^\w.-]/g, "");
  const ref = compact || "privy-user";
  return ref.slice(0, 50);
}
