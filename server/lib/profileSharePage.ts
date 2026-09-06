import { config } from "../config.js";
import type { ProfileShareRecord } from "./profileShareStore.js";

/**
 * Must match the canvas export size in src/utils/profileShare/types.ts.
 * X discards the card image when og:image:width/height disagree with the file.
 */
const SHARE_IMAGE_WIDTH = 1200;
const SHARE_IMAGE_HEIGHT = 675;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildProfileRedirectUrl(): string {
  return new URL("/", config.frontendOrigin).toString();
}

export function buildProfileSharePublicUrls(id: string): {
  shareUrl: string;
  imageUrl: string;
} {
  const base = config.sharePublicBase.replace(/\/+$/, "");
  return {
    shareUrl: `${base}/profile/${id}`,
    imageUrl: `${base}/profile/${id}/image.png`,
  };
}

export function buildProfileShareOgHtml(params: {
  record: ProfileShareRecord;
  shareUrl: string;
  imageUrl: string;
}): string {
  const nftName = params.record.nftName;
  const title = `New profile picture on DorkFi`;
  const description = `I just set ${nftName} as my DorkFi profile picture`;
  const redirectUrl = buildProfileRedirectUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(params.shareUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(params.imageUrl)}" />
  <meta property="og:image:width" content="${SHARE_IMAGE_WIDTH}" />
  <meta property="og:image:height" content="${SHARE_IMAGE_HEIGHT}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="${escapeHtml(description)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(params.imageUrl)}" />
</head>
<body>
  <p><a href="${escapeHtml(redirectUrl)}">Continue to DorkFi</a></p>
</body>
</html>`;
}
