import { describe, it, expect } from "vitest";
import {
  getBorrowShareHelperText,
  getBorrowShareOutcomeMessage,
} from "../shareBorrowConfirmation";

describe("getBorrowShareHelperText", () => {
  it("mentions link preview when share server is available", () => {
    expect(getBorrowShareHelperText(false, true)).toContain("permalink");
  });

  it("mentions unavailable when share server is down", () => {
    expect(getBorrowShareHelperText(false, false)).toContain("unavailable");
  });
});

describe("getBorrowShareOutcomeMessage", () => {
  it("returns link guidance", () => {
    expect(getBorrowShareOutcomeMessage("link").title).toBe(
      "Ready to share on X"
    );
  });

  it("returns clipboard guidance", () => {
    expect(getBorrowShareOutcomeMessage("clipboard").title).toBe(
      "Image copied"
    );
  });
});
