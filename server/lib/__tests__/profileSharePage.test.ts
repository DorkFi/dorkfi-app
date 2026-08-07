import { describe, expect, it } from "vitest";
import {
  buildProfileShareOgHtml,
  buildProfileSharePublicUrls,
} from "../profileSharePage.js";

describe("buildProfileSharePublicUrls", () => {
  it("builds profile share and image URLs", () => {
    const urls = buildProfileSharePublicUrls("abc123");
    expect(urls.shareUrl).toContain("/profile/abc123");
    expect(urls.imageUrl).toContain("/profile/abc123/image.png");
  });
});

describe("buildProfileShareOgHtml", () => {
  it("includes large image twitter card tags", () => {
    const html = buildProfileShareOgHtml({
      record: {
        id: "abc123",
        nftName: "DORK 001",
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000,
      },
      shareUrl: "https://example.com/profile/abc123",
      imageUrl: "https://example.com/profile/abc123/image.png",
    });
    expect(html).toContain('twitter:card" content="summary_large_image"');
    expect(html).toContain("DORK 001");
    expect(html).toContain("og:image:width\" content=\"1200\"");
  });
});
