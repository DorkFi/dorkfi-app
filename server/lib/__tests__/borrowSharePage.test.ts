import { describe, it, expect } from "vitest";
import {
  BORROW_SHARE_HEIGHT,
  BORROW_SHARE_WIDTH,
} from "@/utils/borrowShare/types";
import { buildBorrowShareOgHtml } from "../borrowSharePage";
import type { BorrowShareRecord } from "../borrowShareStore";

const record: BorrowShareRecord = {
  id: "abc123",
  amount: "1",
  assetSymbol: "WAD",
  network: "Algorand",
  createdAt: Date.now(),
  expiresAt: Date.now() + 1000,
};

const html = buildBorrowShareOgHtml({
  record,
  shareUrl: "https://share.example/borrow/abc123",
  imageUrl: "https://share.example/borrow/abc123/image.png",
});

describe("buildBorrowShareOgHtml", () => {
  it("declares the same image size the canvas exports", () => {
    expect(html).toContain(
      `<meta property="og:image:width" content="${BORROW_SHARE_WIDTH}" />`
    );
    expect(html).toContain(
      `<meta property="og:image:height" content="${BORROW_SHARE_HEIGHT}" />`
    );
  });

  it("omits a meta refresh so crawlers resolve the card instead of navigating away", () => {
    expect(html).not.toContain("http-equiv");
  });

  it("requests a large image card with absolute image URLs", () => {
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain(
      '<meta property="og:image" content="https://share.example/borrow/abc123/image.png" />'
    );
  });

  it("includes the borrowed asset in title and description", () => {
    expect(html).toContain("I borrowed WAD on DorkFi");
    expect(html).toContain("Borrowed 1 WAD on @dork_fi");
  });
});
