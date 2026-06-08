import { config } from "../config.js";
import type { GovernanceShareRecord } from "./governanceShareStore.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildGovernanceRedirectUrl(record: GovernanceShareRecord): string {
  const url = new URL("/governance", config.frontendOrigin);
  if (record.proposalId) {
    url.searchParams.set("proposal", record.proposalId);
  }
  return url.toString();
}

export function buildSharePublicUrls(id: string): {
  shareUrl: string;
  imageUrl: string;
} {
  const base = config.sharePublicBase.replace(/\/+$/, "");
  return {
    shareUrl: `${base}/gov/${id}`,
    imageUrl: `${base}/gov/${id}/image.png`,
  };
}

export function buildGovernanceShareOgHtml(params: {
  record: GovernanceShareRecord;
  shareUrl: string;
  imageUrl: string;
}): string {
  const voteLabel = params.record.support ? "YES" : "NO";
  const title = `I voted ${voteLabel} on DorkFi governance`;
  const description = `${params.record.votingPower.toLocaleString("en-US")} $UNIT voting power · ${params.record.proposalTitle}`;
  const redirectUrl = buildGovernanceRedirectUrl(params.record);

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
  <meta property="og:image:width" content="1024" />
  <meta property="og:image:height" content="576" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="${escapeHtml(description)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(params.imageUrl)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
</head>
<body>
  <p><a href="${escapeHtml(redirectUrl)}">Continue to DorkFi governance</a></p>
</body>
</html>`;
}
