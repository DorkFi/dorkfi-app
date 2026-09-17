import { describe, expect, it } from "vitest";
import { cdpFailureMessage, parseCdpBody } from "./cdpResponse";

describe("parseCdpBody", () => {
  it("keeps JSON error fields", () => {
    expect(parseCdpBody('{"error":"nope"}')).toEqual({ error: "nope" });
  });

  it("wraps Coinbase plain-text Unauthorized", () => {
    expect(parseCdpBody("Unauthorized ")).toEqual({ message: "Unauthorized" });
  });
});

describe("cdpFailureMessage", () => {
  it("explains a 401 instead of leaking a JSON parse error", () => {
    const body = parseCdpBody("Unauthorized ");
    expect(cdpFailureMessage(401, body, "Coinbase session failed")).toMatch(
      /CDP unauthorized \(401\)/
    );
  });

  it("passes through JSON error text", () => {
    expect(
      cdpFailureMessage(400, { error: "invalid address" }, "Coinbase session failed")
    ).toBe("invalid address");
  });
});
