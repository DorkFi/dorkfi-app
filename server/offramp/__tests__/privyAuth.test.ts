import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AuthError, bearerToken, requirePrivyAuth } from "../privyAuth.ts";
import {
  handleCoinbaseSession,
  handleCoinbaseStatus,
  handleMoonpaySign,
  loadOfframpEnv,
} from "../handlers.ts";

function mockReq(
  headers: Record<string, string> = {}
): IncomingMessage {
  return {
    headers,
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {},
  } as unknown as IncomingMessage;
}

function mockRes(): ServerResponse & { body: string } {
  const res = {
    statusCode: 0,
    body: "",
    setHeader() {},
    end(payload?: string) {
      res.body = payload ?? "";
    },
  };
  return res as unknown as ServerResponse & { body: string };
}

describe("bearerToken", () => {
  it("reads a Bearer token", () => {
    assert.equal(
      bearerToken(mockReq({ authorization: "Bearer abc.def.ghi" })),
      "abc.def.ghi"
    );
  });

  it("returns null when missing", () => {
    assert.equal(bearerToken(mockReq()), null);
    assert.equal(bearerToken(mockReq({ authorization: "Basic x" })), null);
  });
});

describe("requirePrivyAuth", () => {
  it("rejects a missing token before calling Privy", async () => {
    await assert.rejects(
      () => requirePrivyAuth(mockReq(), "cm-test-app"),
      (error: unknown) => {
        assert.equal(error instanceof AuthError, true);
        assert.equal((error as AuthError).status, 401);
        assert.equal((error as AuthError).message, "Authentication required");
        return true;
      }
    );
  });

  it("rejects a malformed token without treating it as authenticated", async () => {
    await assert.rejects(
      () =>
        requirePrivyAuth(
          mockReq({ authorization: "Bearer not-a-jwt" }),
          "cm-test-app"
        ),
      (error: unknown) => error instanceof AuthError
    );
  });
});

describe("Coinbase / MoonPay handlers require a Privy session", () => {
  const env = loadOfframpEnv({
    CDP_API_KEY_ID: "id",
    CDP_API_KEY_SECRET: "secret",
    MOONPAY_SECRET_KEY: "moon",
  });

  it("returns 401 from session create without Authorization", async () => {
    const res = mockRes();
    await handleCoinbaseSession(mockReq(), res, env);
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).error, "Authentication required");
  });

  it("returns 401 from sell status without Authorization", async () => {
    const res = mockRes();
    await handleCoinbaseStatus(mockReq(), res, env, "df-ref");
    assert.equal(res.statusCode, 401);
  });

  it("returns 401 from MoonPay sign without Authorization", async () => {
    const res = mockRes();
    await handleMoonpaySign(mockReq(), res, env);
    assert.equal(res.statusCode, 401);
  });
});
