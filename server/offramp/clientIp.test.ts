import { describe, expect, it } from "vitest";
import {
  coinbaseClientIp,
  endUserIp,
  isPrivateOrLoopbackIp,
  partnerUserRefFromUserId,
} from "./clientIp";

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

  it("treats loopback and LAN addresses as private", () => {
    expect(isPrivateOrLoopbackIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackIp("10.0.0.114")).toBe(true);
    expect(isPrivateOrLoopbackIp("192.168.1.20")).toBe(true);
    expect(isPrivateOrLoopbackIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrLoopbackIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrLoopbackIp("172.217.14.206")).toBe(false);
  });

  it("keeps a public edge IP", async () => {
    await expect(
      coinbaseClientIp(
        {
          headers: { "cf-connecting-ip": "203.0.113.10" },
          socket: { remoteAddress: "127.0.0.1" },
        },
        { lookupPublicIp: async () => "1.1.1.1" }
      )
    ).resolves.toBe("203.0.113.10");
  });

  it("replaces localhost with the override or a looked-up public IP", async () => {
    const req = {
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    };
    await expect(
      coinbaseClientIp(req, {
        override: "203.0.113.9",
        lookupPublicIp: async () => "1.1.1.1",
      })
    ).resolves.toBe("203.0.113.9");
    await expect(
      coinbaseClientIp(req, { lookupPublicIp: async () => "198.51.100.8" })
    ).resolves.toBe("198.51.100.8");
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
