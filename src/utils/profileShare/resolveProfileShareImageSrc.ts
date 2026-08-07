import { xShareApiBase } from "@/services/xShareService";

/** CDN hosts that need the share-server proxy for canvas CORS. */
const PROXY_HOSTS = new Set([
  "prod.cdn.highforge.io",
  "cdn.highforge.io",
]);

/**
 * Rewrites external NFT CDN URLs through the share server image proxy so
 * `canvas` can load them with `crossOrigin="anonymous"` and export a PNG.
 */
export function resolveProfileShareImageSrc(raw: string): string {
  const src = raw.trim();
  if (!src) return src;

  try {
    const url = new URL(src, window.location.origin);
    if (!PROXY_HOSTS.has(url.hostname.toLowerCase())) {
      return src;
    }
  } catch {
    return src;
  }

  const base = xShareApiBase().replace(/\/+$/, "");
  return `${base}/share/image-proxy?url=${encodeURIComponent(src)}`;
}
