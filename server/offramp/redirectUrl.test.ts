import { describe, expect, it } from "vitest";
import { isAllowedRedirectUrl, resolveCoinbaseRedirectUrl } from "./redirectUrl";

describe("isAllowedRedirectUrl", () => {
  it("requires an allowlisted origin", () => {
    expect(
      isAllowedRedirectUrl("https://beta.simplfi.xyz/portfolio", [
        "https://beta.simplfi.xyz",
      ])
    ).toBe(true);
    expect(
      isAllowedRedirectUrl("https://evil.example/portfolio", [
        "https://beta.simplfi.xyz",
      ])
    ).toBe(false);
  });
});

describe("resolveCoinbaseRedirectUrl", () => {
  it("uses the request origin, not localhost, in production-like requests", () => {
    expect(
      resolveCoinbaseRedirectUrl(
        { headers: { origin: "https://beta.simplfi.xyz" } },
        "https://evil.example/hack",
        {}
      )
    ).toBe("https://beta.simplfi.xyz/portfolio");
  });

  it("accepts a requested URL on the same origin", () => {
    expect(
      resolveCoinbaseRedirectUrl(
        { headers: { origin: "https://beta.simplfi.xyz" } },
        "https://beta.simplfi.xyz/portfolio",
        {}
      )
    ).toBe("https://beta.simplfi.xyz/portfolio");
  });

  it("prefers the configured allowlisted redirect when origin matches", () => {
    expect(
      resolveCoinbaseRedirectUrl(
        { headers: { origin: "https://beta.simplfi.xyz" } },
        undefined,
        { VITE_OFFRAMP_REDIRECT_URL: "https://beta.simplfi.xyz/portfolio" }
      )
    ).toBe("https://beta.simplfi.xyz/portfolio");
  });
});
