import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { partnerUserRefFromUserId } from "./clientIp";
import { handleCoinbaseStatus, loadOfframpEnv } from "./handlers";
import { AuthError } from "./privyAuth";

function mockReq(): IncomingMessage {
  return {
    headers: {},
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

describe("handleCoinbaseStatus", () => {
  const env = loadOfframpEnv({});
  const userA = "did:privy:user-a";

  it("returns 401 without a session and does not load sells", async () => {
    const res = mockRes();
    let calls = 0;
    await handleCoinbaseStatus(mockReq(), res, env, "privy-user-a", {
      loadSells: async () => {
        calls += 1;
        return {};
      },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("Authentication required");
    expect(calls).toBe(0);
  });

  it("returns 403 for another user's ref without calling Coinbase", async () => {
    const res = mockRes();
    let calls = 0;
    await handleCoinbaseStatus(
      mockReq(),
      res,
      env,
      partnerUserRefFromUserId("did:privy:user-b"),
      {
        authenticate: async () => ({ userId: userA }),
        loadSells: async () => {
          calls += 1;
          return {};
        },
      }
    );
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: "Forbidden" });
    expect(calls).toBe(0);
  });

  it("returns 403 for an algo ref without calling Coinbase", async () => {
    const res = mockRes();
    let calls = 0;
    await handleCoinbaseStatus(mockReq(), res, env, `algo-${"ab".repeat(20)}`, {
      authenticate: async () => ({ userId: userA }),
      loadSells: async () => {
        calls += 1;
        return {};
      },
    });
    expect(res.statusCode).toBe(403);
    expect(calls).toBe(0);
  });

  it("returns only the public fields of this user's sale", async () => {
    const res = mockRes();
    const ref = partnerUserRefFromUserId(userA);
    await handleCoinbaseStatus(mockReq(), res, env, ref, {
      authenticate: async () => ({ userId: userA }),
      loadSells: async (_env, requested) => {
        expect(requested).toBe(ref);
        return {
          transactions: [
            {
              status: "TRANSACTION_STATUS_STARTED",
              asset: "ALGO",
              network: "algorand",
              sell_amount: { value: "12.5", currency: "ALGO" },
              to_address: "ADDR",
              from_address: "FROM",
              payment_method: { id: "secret" },
              user: { email: "a@b.c" },
            },
          ],
        };
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      latest: Record<string, unknown>;
    };
    expect(body.latest).toEqual({
      status: "TRANSACTION_STATUS_STARTED",
      asset: "ALGO",
      network: "algorand",
      sell_amount: { value: "12.5", currency: "ALGO" },
      to_address: "ADDR",
      from_address: "FROM",
    });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("a@b.c");
  });

  it("preserves an AuthError status", async () => {
    const res = mockRes();
    await handleCoinbaseStatus(mockReq(), res, env, "x", {
      authenticate: async () => {
        throw new AuthError(503, "Privy app id is not configured");
      },
    });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toBe("Privy app id is not configured");
  });
});
