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

/** Stable CDP partnerUserRef from a Privy user id (max 50 chars). */
export function partnerUserRefFromUserId(userId: string): string {
  const compact = userId.replace(/^did:privy:/, "privy-").replace(/[^\w.-]/g, "");
  const ref = compact || "privy-user";
  return ref.slice(0, 50);
}
