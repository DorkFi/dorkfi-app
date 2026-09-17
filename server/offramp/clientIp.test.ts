import { describe, expect, it } from "vitest";
import { endUserIp, partnerUserRefFromUserId } from "./clientIp";

describe("endUserIp", () => {
  it("ignores X-Forwarded-For in favor of Cloudflare / X-Real-IP", () => {
    expect(
      endUserIp({
        headers: {
          "x-forwarded-for": "1.2.3.4, 10.0.0.1",
          "cf-connecting-ip": "8.8.4.4",
        },
        socket: { remoteAddress: "10.1.1.1" },
      })
    ).toBe("8.8.4.4");
    expect(
      endUserIp({
        headers: {
          "x-forwarded-for": "9.9.9.9",
          "x-real-ip": "203.0.113.10",
        },
        socket: { remoteAddress: "10.1.1.1" },
      })
    ).toBe("203.0.113.10");
  });

  it("does not use a spoofable X-Forwarded-For when no edge header exists", () => {
    expect(
      endUserIp({
        headers: { "x-forwarded-for": "1.2.3.4" },
        socket: { remoteAddress: "10.9.8.7" },
      })
    ).toBe("10.9.8.7");
  });
});

describe("partnerUserRefFromUserId", () => {
  it("stays within 50 chars and is stable", () => {
    const id = "did:privy:clxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    const ref = partnerUserRefFromUserId(id);
    expect(ref.startsWith("privy-")).toBe(true);
    expect(ref.length).toBeLessThanOrEqual(50);
    expect(partnerUserRefFromUserId(id)).toBe(ref);
  });
});
