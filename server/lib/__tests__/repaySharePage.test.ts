import { describe, it, expect } from "vitest";
import { REPAY_SHARE_HEIGHT, REPAY_SHARE_WIDTH } from "@/utils/repayShare/types";
import { buildRepayShareOgHtml } from "../repaySharePage";
import type { RepayShareRecord } from "../repayShareStore";

const record: RepayShareRecord = {
  id: "abc123",
  amount: "1",
  assetSymbol: "WAD",
  paidWithSymbol: "USDC",
  network: "Algorand",
  createdAt: Date.now(),
  expiresAt: Date.now() + 1000,
};

const html = buildRepayShareOgHtml({
  record,
  shareUrl: "https://share.example/repay/abc123",
  imageUrl: "https://share.example/repay/abc123/image.png",
});

describe("buildRepayShareOgHtml", () => {
  it("declares the same image size the canvas exports", () => {
    expect(html).toContain(
      `<meta property="og:image:width" content="${REPAY_SHARE_WIDTH}" />`
    );
    expect(html).toContain(
      `<meta property="og:image:height" content="${REPAY_SHARE_HEIGHT}" />`
    );
  });

  it("omits a meta refresh so crawlers resolve the card instead of navigating away", () => {
    expect(html).not.toContain("http-equiv");
  });

  it("requests a large image card with absolute image URLs", () => {
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain(
      '<meta property="og:image" content="https://share.example/repay/abc123/image.png" />'
    );
  });

  it("includes the cross-asset payment ticker in title and description", () => {
    expect(html).toContain("I repaid my WAD loan with USDC on DorkFi");
    expect(html).toContain("Repaid 1 WAD using USDC on @Dork_Fi");
  });
});
