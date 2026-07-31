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
    {
      symbol: "USDC",
      poolId: "1",
      underlyingContractId: "301",
      originalContractId: "300",
      configKey: "USDC",
      originalSymbol: "fiUSDC",
    },
    {
      symbol: "USDC",
      poolId: "1",
      underlyingContractId: "401",
      originalContractId: "400",
      configKey: "USDC",
      originalSymbol: "fUSDC",
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

  it("matches originalContractId when market id is the display ASA", () => {
    expect(
      resolveSupplyBorrowToken(tokens, "USDC", "1", "USDC", "400")
        ?.originalSymbol
    ).toBe("fUSDC");
  });

  it("disambiguates multi-USDC rows via marketId among configKey hits", () => {
    expect(
      resolveSupplyBorrowToken(tokens, "USDC", "1", "USDC", "301")
        ?.originalSymbol
    ).toBe("fiUSDC");
  });
});
