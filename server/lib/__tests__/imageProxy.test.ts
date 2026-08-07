import { describe, expect, it } from "vitest";
import {
  contentTypeForImageUrl,
  isAllowedImageProxyUrl,
} from "../imageProxy.js";

describe("isAllowedImageProxyUrl", () => {
  it("allows Highforge CDN https URLs", () => {
    expect(
      isAllowedImageProxyUrl("https://prod.cdn.highforge.io/m/313597/1.webp")
    ).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(isAllowedImageProxyUrl("https://evil.example/x.png")).toBe(false);
  });
});

describe("contentTypeForImageUrl", () => {
  it("maps webp/png from extension", () => {
    expect(
      contentTypeForImageUrl("https://prod.cdn.highforge.io/m/1.webp", "")
    ).toBe("image/webp");
    expect(
      contentTypeForImageUrl("https://prod.cdn.highforge.io/m/1.png", "")
    ).toBe("image/png");
  });
});
