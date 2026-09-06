import { describe, it, expect } from "vitest";
import {
  buildXIntentUrl,
  getRepayShareHelperText,
  getShareOutcomeMessage,
} from "../shareRepayConfirmation";

describe("buildXIntentUrl", () => {
  it("encodes tweet text", () => {
    expect(buildXIntentUrl("hello world")).toBe(
      "https://x.com/intent/tweet?text=hello%20world"
    );
  });
});

describe("getRepayShareHelperText", () => {
  it("mentions link preview when share server is available", () => {
    expect(getRepayShareHelperText(false, true)).toContain("permalink");
  });

  it("mentions unavailable when share server is down", () => {
    expect(getRepayShareHelperText(false, false)).toContain("unavailable");
  });
});

describe("getShareOutcomeMessage", () => {
  it("returns link guidance", () => {
    expect(getShareOutcomeMessage("link").title).toBe("Ready to share on X");
  });

  it("returns clipboard guidance", () => {
    expect(getShareOutcomeMessage("clipboard").title).toBe("Image copied");
  });
});
