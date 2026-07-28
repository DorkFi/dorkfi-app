import { config } from "../config.js";
import type { RepayShareRecord } from "./repayShareStore.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildRepayRedirectUrl(): string {
  return new URL("/", config.frontendOrigin).toString();
}

export function buildRepaySharePublicUrls(id: string): {
  shareUrl: string;
  imageUrl: string;
} {
  const base = config.sharePublicBase.replace(/\/+$/, "");
  return {
    shareUrl: `${base}/repay/${id}`,
    imageUrl: `${base}/repay/${id}/image.png`,
  };
}

export function buildRepayShareOgHtml(params: {
  record: RepayShareRecord;
  shareUrl: string;
  imageUrl: string;
}): string {
  const asset = params.record.assetSymbol;
  const paid = params.record.paidWithSymbol;
  const title = paid
    ? `I repaid my ${asset} loan with ${paid} on DorkFi`
    : `I repaid my ${asset} loan on DorkFi`;
  const description = paid
    ? `Repaid ${params.record.amount} ${asset} using ${paid} on @Dork_Fi`
    : `Repaid ${params.record.amount} ${asset} on @Dork_Fi`;
  const redirectUrl = buildRepayRedirectUrl();

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
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="675" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="${escapeHtml(description)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(params.imageUrl)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
</head>
<body>
  <p><a href="${escapeHtml(redirectUrl)}">Continue to DorkFi</a></p>
</body>
</html>`;
}
