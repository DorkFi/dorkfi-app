import { describe, expect, it } from "vitest";
import { resolveSupplyBorrowToken } from "./resolveSupplyBorrowToken";

describe("resolveSupplyBorrowToken", () => {
  const tokens = [
    {
      symbol: "UNIT",
      poolId: "1",
      underlyingContractId: "100",
      configKey: "UNIT",
      originalSymbol: "UNIT",
    },
    {
      symbol: "UNIT",
      poolId: "2",
      underlyingContractId: "200",
      configKey: "UNIT",
      originalSymbol: "UNIT",
    },
  ];

  it("prefers market contract + pool when provided", () => {
    expect(
      resolveSupplyBorrowToken(tokens, "UNIT", "2", "UNIT", "200")
        ?.underlyingContractId
    ).toBe("200");
  });

  it("falls back to config symbol + pool", () => {
    expect(
      resolveSupplyBorrowToken(tokens, "UNIT", "1", "UNIT")?.poolId
    ).toBe("1");
  });
});
