import { describe, expect, it } from "vitest";
import {
  isMythLpConfigKey,
  listedMythLpTokensFromEnv,
  parseListedMythLpMarketEnv,
} from "@/config";

describe("parseListedMythLpMarketEnv", () => {
  it("parses poolId,contractId,nTokenId", () => {
    expect(parseListedMythLpMarketEnv("3333688282,4000000001,4000000002")).toEqual({
      poolId: "3333688282",
      contractId: "4000000001",
      nTokenId: "4000000002",
    });
  });

  it("trims whitespace", () => {
    expect(
      parseListedMythLpMarketEnv(" 3333688282 , 4000000001 , 4000000002 ")
    ).toEqual({
      poolId: "3333688282",
      contractId: "4000000001",
      nTokenId: "4000000002",
    });
  });

  it("rejects incomplete or non-positive ids", () => {
    expect(parseListedMythLpMarketEnv("")).toBeNull();
    expect(parseListedMythLpMarketEnv("3333688282,4000000001")).toBeNull();
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
