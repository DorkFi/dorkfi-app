import { describe, expect, it } from "vitest";
import { proposalsNextPageCursor } from "./governanceApi";

describe("proposalsNextPageCursor", () => {
  it("prefers nextCursor when present", () => {
    expect(
      proposalsNextPageCursor({ nextCursor: "abc", cursor: "old" }, "old")
    ).toBe("abc");
  });

  it("returns undefined when no more pages", () => {
    expect(proposalsNextPageCursor({ cursor: "x" }, undefined)).toBeUndefined();
  });

  it("uses cursor when hasMore and cursor differs from request", () => {
    expect(
      proposalsNextPageCursor(
        { hasNextPage: true, cursor: "page2" },
        "page1"
      )
    ).toBe("page2");
  });

  it("does not reuse echoed cursor when it matches requested cursor", () => {
    expect(
      proposalsNextPageCursor({ hasNextPage: true, cursor: "same" }, "same")
    ).toBeUndefined();
  });

  it("allows echoed cursor when first page had no cursor", () => {
    expect(
      proposalsNextPageCursor({ hasNextPage: true, cursor: "first" }, undefined)
    ).toBe("first");
  });
});
