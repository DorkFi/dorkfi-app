import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import {
  forwardedHeaderForIp,
  xoClientForwardedHeader,
} from "./handlers";

function req(headers: Record<string, string>, remoteAddress?: string): IncomingMessage {
  return {
    headers,
    socket: { remoteAddress },
  } as IncomingMessage;
}

describe("forwardedHeaderForIp", () => {
  it("formats IPv4 and quoted IPv6", () => {
    expect(forwardedHeaderForIp("203.0.113.10")).toBe("for=203.0.113.10");
    expect(forwardedHeaderForIp("2001:db8::1")).toBe('for="[2001:db8::1]"');
    expect(forwardedHeaderForIp("::ffff:203.0.113.5")).toBe("for=203.0.113.5");
  });

  it("drops loopback and private addresses", () => {
    expect(forwardedHeaderForIp("127.0.0.1")).toBeUndefined();
    expect(forwardedHeaderForIp("10.1.1.1")).toBeUndefined();
    expect(forwardedHeaderForIp("192.168.1.4")).toBeUndefined();
    expect(forwardedHeaderForIp("fd00::1")).toBeUndefined();
  });
});

describe("xoClientForwardedHeader", () => {
  it("uses the edge client IP instead of X-Forwarded-For", () => {
    expect(
      xoClientForwardedHeader(
        req(
          {
            "x-forwarded-for": "1.2.3.4, 10.0.0.1",
            "cf-connecting-ip": "8.8.4.4",
          },
          "10.1.1.1"
        )
      )
    ).toBe("for=8.8.4.4");
    expect(
      xoClientForwardedHeader(
        req(
          {
            "x-forwarded-for": "9.9.9.9",
            "x-real-ip": "203.0.113.10",
          },
          "10.1.1.1"
        )
      )
    ).toBe("for=203.0.113.10");
  });

  it("does not forward a spoofed X-Forwarded-For or a private peer", () => {
    expect(
      xoClientForwardedHeader(
        req({ "x-forwarded-for": "1.2.3.4" }, "10.9.8.7")
      )
    ).toBeUndefined();
  });
});
