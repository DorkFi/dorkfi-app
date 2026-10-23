import { describe, expect, it } from "vitest";
import {
  buildListedMythLpTokens,
  isMythLpConfigKey,
  isRegisterableMythLpPoolId,
  listedMythLpTokensFromEnv,
  parseListedMythLpMarketEnv,
} from "@/config";

describe("parseListedMythLpMarketEnv", () => {
  it("parses poolId,contractId,nTokenId", () => {
    expect(parseListedMythLpMarketEnv("3345940978,4000000001,4000000002")).toEqual({
      poolId: "3345940978",
      contractId: "4000000001",
      nTokenId: "4000000002",
    });
  });

  it("trims whitespace", () => {
    expect(
      parseListedMythLpMarketEnv(" 3345940978 , 4000000001 , 4000000002 ")
    ).toEqual({
      poolId: "3345940978",
      contractId: "4000000001",
      nTokenId: "4000000002",
    });
  });

  it("rejects incomplete or non-positive ids", () => {
    expect(parseListedMythLpMarketEnv("")).toBeNull();
    expect(parseListedMythLpMarketEnv("3345940978,4000000001")).toBeNull();
    expect(parseListedMythLpMarketEnv("3333688282,0,1")).toBeNull();
    expect(parseListedMythLpMarketEnv("pool,contract,ntoken")).toBeNull();
  });
});

describe("isMythLpConfigKey", () => {
  it("matches LP_MYTH_ keys only", () => {
    expect(isMythLpConfigKey("LP_MYTH_COOP_ALGO")).toBe(true);
    expect(isMythLpConfigKey("LP_TMPOOL2_UNIT_ALGO")).toBe(false);
    expect(isMythLpConfigKey("COOP")).toBe(false);
    expect(isMythLpConfigKey(null)).toBe(false);
  });
});

describe("listedMythLpTokensFromEnv", () => {
  it("is empty when tester env vars are unset", () => {
    expect(listedMythLpTokensFromEnv()).toEqual({});
  });
});

describe("isRegisterableMythLpPoolId", () => {
  it("rejects Pool A and Tinyman LP pools, unknown ids, and allows isolated known pools", () => {
    expect(isRegisterableMythLpPoolId("3333688282")).toBe(false);
    expect(isRegisterableMythLpPoolId("3578814346")).toBe(false);
    expect(isRegisterableMythLpPoolId("3585829377")).toBe(false);
    expect(isRegisterableMythLpPoolId("3589083110")).toBe(false);
    expect(isRegisterableMythLpPoolId("999")).toBe(false);
    expect(isRegisterableMythLpPoolId("3345940978")).toBe(true);
    expect(isRegisterableMythLpPoolId("3526240577")).toBe(true);
  });
});

describe("buildListedMythLpTokens", () => {
  const coopOnPoolA = "3333688282,4000000001,4000000002";
  const coopOnPoolB = "3345940978,4000000001,4000000002";
  const coopUnknown = "111,4000000001,4000000002";

  it("does not register tokens when the lending flag is off", () => {
    expect(
      buildListedMythLpTokens(false, { LP_MYTH_COOP_ALGO: coopOnPoolB })
    ).toEqual({});
  });

  it("rejects Pool A and unknown pool ids even when the flag is on", () => {
    expect(
      buildListedMythLpTokens(true, { LP_MYTH_COOP_ALGO: coopOnPoolA })
    ).toEqual({});
    expect(
      buildListedMythLpTokens(true, { LP_MYTH_COOP_ALGO: coopUnknown })
    ).toEqual({});
  });

  it("registers a listed market on a known non-shared pool", () => {
    const tokens = buildListedMythLpTokens(true, {
      LP_MYTH_COOP_ALGO: coopOnPoolB,
    });
    expect(tokens.LP_MYTH_COOP_ALGO?.poolId).toBe("3345940978");
    expect(tokens.LP_MYTH_COOP_ALGO?.contractId).toBe("4000000001");
    expect(tokens.LP_MYTH_COOP_ALGO?.nTokenId).toBe("4000000002");
  });
});
