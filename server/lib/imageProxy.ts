/** Hosts allowed for profile-share / OG canvas image proxying. */
const ALLOWED_HOSTS = new Set([
  "prod.cdn.highforge.io",
  "cdn.highforge.io",
]);

export function isAllowedImageProxyUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    return ALLOWED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function contentTypeForImageUrl(raw: string, fallback: string): string {
  const lower = raw.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (fallback.startsWith("image/")) return fallback;
  return "application/octet-stream";
}
