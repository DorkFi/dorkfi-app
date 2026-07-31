import { describe, it, expect } from "vitest";
import {
  buildBorrowShareTweetText,
  buildGenericBorrowShareTweetText,
  formatBorrowHeadline,
  formatBorrowTickerLabel,
} from "../format";
import {
  BORROW_SHARE_TEMPLATE_PATH,
  resolveBorrowShareTemplatePath,
} from "../types";

describe("resolveBorrowShareTemplatePath", () => {
  it("returns the borrow confirmation template path", () => {
    expect(resolveBorrowShareTemplatePath()).toBe(BORROW_SHARE_TEMPLATE_PATH);
  });
});

describe("formatBorrowHeadline", () => {
  it("returns I BORROWED", () => {
    expect(formatBorrowHeadline()).toBe("I BORROWED");
  });
});

describe("formatBorrowTickerLabel", () => {
  it("uppercases the ticker", () => {
    expect(formatBorrowTickerLabel("wad")).toBe("WAD");
  });

  it("falls back when empty", () => {
    expect(formatBorrowTickerLabel("")).toBe("ASSET");
  });
});

describe("buildBorrowShareTweetText", () => {
  it("includes asset and default link without amount", () => {
    const text = buildBorrowShareTweetText({
      amount: "100",
      assetSymbol: "USDC",
    });
    expect(text).toBe(
      [
        "I borrowed USDC from @dork_fi",
        "",
        "#DorkFi",
        "",
        "https://app.dork.fi",
      ].join("\n")
    );
    expect(text).not.toContain("100");
  });

  it("adds #Algorand for Algorand networks", () => {
    const text = buildBorrowShareTweetText({
      amount: "50",
      assetSymbol: "ALGO",
      network: "algorand-mainnet",
    });
    expect(text).toContain("I borrowed ALGO from @dork_fi");
    expect(text).toContain("#DorkFi #Algorand");
  });

  it("adds #VoiNetwork for Voi networks", () => {
    const text = buildBorrowShareTweetText({
      amount: "10",
      assetSymbol: "VOI",
      network: "voi-mainnet",
    });
    expect(text).toContain("#DorkFi #VoiNetwork");
  });

  it("uses the share permalink when provided", () => {
    const text = buildBorrowShareTweetText({
      amount: "100",
      assetSymbol: "WAD",
      network: "algorand-mainnet",
      shareUrl: "https://share.dork.fi/borrow/RXoZeL216VXe",
    });
    expect(text).toBe(
      [
        "I borrowed WAD from @dork_fi",
        "",
        "#DorkFi #Algorand",
        "",
        "https://share.dork.fi/borrow/RXoZeL216VXe",
      ].join("\n")
    );
  });
});

describe("buildGenericBorrowShareTweetText", () => {
  it("uses custom share URL when provided", () => {
    expect(buildGenericBorrowShareTweetText("https://example.com")).toBe(
      [
        "I borrowed from @dork_fi",
        "",
        "#DorkFi",
        "",
        "https://example.com",
      ].join("\n")
    );
  });
});
