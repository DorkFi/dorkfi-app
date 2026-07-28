import { describe, it, expect } from "vitest";
import {
  buildGenericRepayShareTweetText,
  buildRepayShareTweetText,
  formatRepayAmountLabel,
  formatRepayContextLabel,
  formatRepayDebtLoanLabel,
  formatRepayHeadline,
  formatRepayWithLabel,
  shouldShowPaidWithRow,
  splitRepayTitleLines,
} from "../format";
import {
  REPAY_SHARE_TEMPLATE_PATH,
  resolveRepayShareTemplatePath,
} from "../types";

describe("resolveRepayShareTemplatePath", () => {
  it("returns the repay confirmation template path", () => {
    expect(resolveRepayShareTemplatePath()).toBe(REPAY_SHARE_TEMPLATE_PATH);
  });
});

describe("formatRepayHeadline", () => {
  it("returns I REPAID MY", () => {
    expect(formatRepayHeadline()).toBe("I REPAID MY");
  });
});

describe("formatRepayDebtLoanLabel", () => {
  it("appends LOAN to the ticker", () => {
    expect(formatRepayDebtLoanLabel("wad")).toBe("WAD LOAN");
  });
});

describe("formatRepayAmountLabel", () => {
  it("joins amount and asset", () => {
    expect(formatRepayAmountLabel("1,234.56", "USDC")).toBe("1,234.56 USDC");
  });

  it("falls back when empty", () => {
    expect(formatRepayAmountLabel("", "")).toBe("0 ASSET");
  });
});

describe("formatRepayContextLabel", () => {
  it("uppercases network when provided", () => {
    expect(formatRepayContextLabel("algorand")).toBe("ON ALGORAND");
  });

  it("defaults to DorkFi", () => {
    expect(formatRepayContextLabel()).toBe("ON DORKFI");
  });
});

describe("formatRepayWithLabel", () => {
  it("returns WITH", () => {
    expect(formatRepayWithLabel()).toBe("WITH");
  });
});

describe("shouldShowPaidWithRow", () => {
  it("is true when payment ticker differs from debt", () => {
    expect(shouldShowPaidWithRow("WAD", "ALGO")).toBe(true);
  });

  it("is false when tickers match (case-insensitive)", () => {
    expect(shouldShowPaidWithRow("WAD", "wad")).toBe(false);
  });

  it("is false when payment ticker is missing", () => {
    expect(shouldShowPaidWithRow("WAD")).toBe(false);
  });
});

describe("splitRepayTitleLines", () => {
  it("splits amount and asset onto two lines when two tokens", () => {
    expect(splitRepayTitleLines("1234.56 USDC")).toEqual([
      "1234.56",
      "USDC",
    ]);
  });

  it("uses fallback when title is empty", () => {
    expect(splitRepayTitleLines("   ")).toEqual(["LOAN", "REPAYMENT"]);
  });
});

describe("buildRepayShareTweetText", () => {
  it("includes amount, asset, and default link", () => {
    const text = buildRepayShareTweetText({
      amount: "100",
      assetSymbol: "USDC",
    });
    expect(text).toContain("100 USDC");
    expect(text).toContain("@Dork_Fi");
    expect(text).toContain("https://app.dork.fi");
    expect(text).toContain("#DorkFi");
  });

  it("includes network when provided", () => {
    const text = buildRepayShareTweetText({
      amount: "50",
      assetSymbol: "ALGO",
      network: "Algorand",
    });
    expect(text).toContain("on Algorand");
  });
});

describe("buildGenericRepayShareTweetText", () => {
  it("uses custom share URL when provided", () => {
    expect(buildGenericRepayShareTweetText("https://example.com")).toContain(
      "https://example.com"
    );
  });
});
