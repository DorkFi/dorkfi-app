import { describe, expect, it } from "vitest";
import {
  XO_GEO_RESTRICTED_MESSAGE,
  formatXoSwapError,
  isXoGeoRestricted,
} from "@/lib/easyStart/xoSwap/errors";

describe("xoSwap errors", () => {
  it("detects Exodus geo codes", () => {
    expect(
      isXoGeoRestricted({
        status: 403,
        code: "RESTRICTED_GEOLOCATION",
        details: "Restricted location",
      })
    ).toBe(true);
    expect(isXoGeoRestricted(new Error("Restricted location"))).toBe(true);
    expect(isXoGeoRestricted(new Error(XO_GEO_RESTRICTED_MESSAGE))).toBe(true);
    expect(isXoGeoRestricted("no fixed rate")).toBe(false);
  });

  it("maps geo errors to a user-facing message", () => {
    expect(
      formatXoSwapError(
        { code: "RESTRICTED_GEOLOCATION", details: "Restricted location" },
        "Swap failed"
      )
    ).toBe(XO_GEO_RESTRICTED_MESSAGE);
    expect(formatXoSwapError(new Error("Order expired"), "Swap failed")).toBe(
      "Order expired"
    );
  });
});
