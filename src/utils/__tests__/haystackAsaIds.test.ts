import { describe, expect, it } from "vitest";
import {
  listHaystackPaymentAssets,
  resolveHaystackAsaId,
  resolveHaystackDebtAsaId,
} from "@/utils/haystackAsaIds";
import type { TokenConfig } from "@/config";

function tok(
  partial: Partial<TokenConfig> &
    Pick<
      TokenConfig,
      "tokenStandard" | "decimals" | "name" | "symbol" | "logoPath"
    >
): TokenConfig {
  return partial as TokenConfig;
}

describe("resolveHaystackAsaId", () => {
  it("maps network native to 0", () => {
    expect(
      resolveHaystackAsaId(
        tok({
          assetId: "0",
          tokenStandard: "network",
          decimals: 6,
          name: "ALGO",
          symbol: "ALGO",
          logoPath: "/",
        })
      )
    ).toBe(0);
  });

  it("maps ASA ids", () => {
    expect(
      resolveHaystackAsaId(
        tok({
          assetId: "31566704",
          tokenStandard: "asa",
          decimals: 6,
          name: "USDC",
          symbol: "USDC",
          logoPath: "/",
        })
      )
    ).toBe(31566704);
  });

  it("maps sToken WAD ASA (isStoken no longer blocks)", () => {
    expect(
      resolveHaystackAsaId(
        tok({
          assetId: "3334160924",
          tokenStandard: "arc200-exchange",
          isStoken: true,
          decimals: 6,
          name: "WAD",
          symbol: "WAD",
          logoPath: "/",
        })
      )
    ).toBe(3334160924);
  });

  it("skips pure arc200 without assetId", () => {
    expect(
      resolveHaystackAsaId(
        tok({
          tokenStandard: "arc200",
          decimals: 6,
          name: "x",
          symbol: "x",
          logoPath: "/",
        })
      )
    ).toBeNull();
  });
});

describe("resolveHaystackDebtAsaId", () => {
  it("resolves Algorand WAD ASA from symbol when config is missing", () => {
    const asa = resolveHaystackDebtAsaId({
      networkId: "algorand-mainnet",
      tokenSymbol: "WAD",
      poolId: "3345940978",
    });
    expect(asa).toBe(3334160924);
  });

  it("resolves sToken WAD pool ASA", () => {
    const asa = resolveHaystackDebtAsaId({
      networkId: "algorand-mainnet",
      tokenSymbol: "WAD",
      poolId: "3333688282",
      repayTokenConfig: tok({
        assetId: "3334160924",
        poolId: "3333688282",
        tokenStandard: "arc200-exchange",
        isStoken: true,
        decimals: 6,
        name: "WAD",
        symbol: "WAD",
        logoPath: "/",
      }),
    });
    expect(asa).toBe(3334160924);
  });
});

describe("listHaystackPaymentAssets", () => {
  it("returns unique ASA rows for algorand-mainnet excluding debt", () => {
    const rows = listHaystackPaymentAssets("algorand-mainnet", 31566704);
    expect(rows.some((r) => r.asaId === 31566704)).toBe(false);
    expect(rows.some((r) => r.asaId === 0)).toBe(true);
    const ids = rows.map((r) => r.asaId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("omits TMPOOL2 / Tinyman LP tokens", () => {
    const rows = listHaystackPaymentAssets("algorand-mainnet");
    expect(rows.some((r) => r.symbol === "TMPOOL2")).toBe(false);
    // Known UNIT-ALGO TMPOOL2 ASA from config
    expect(rows.some((r) => r.asaId === 3157974960)).toBe(false);
  });

  it("omits PEPE, COMPX, SOL, AVAX, LINK, and xUSD", () => {
    const rows = listHaystackPaymentAssets("algorand-mainnet");
    for (const sym of ["PEPE", "COMPX", "SOL", "AVAX", "LINK", "xUSD"]) {
      expect(rows.some((r) => r.symbol === sym)).toBe(false);
    }
  });

  it("omits excluded ASA ids 1058926737 and 887406851", () => {
    const rows = listHaystackPaymentAssets("algorand-mainnet");
    expect(rows.some((r) => r.asaId === 1058926737)).toBe(false);
    expect(rows.some((r) => r.asaId === 887406851)).toBe(false);
  });

  it("labels Folks fUSDC distinctly from native USDC", () => {
    const rows = listHaystackPaymentAssets("algorand-mainnet");
    const native = rows.find((r) => r.asaId === 31566704);
    const folks = rows.find((r) => r.asaId === 971384592);
    expect(native?.symbol).toBe("USDC");
    expect(native?.name).toBe("USD Coin");
    expect(folks?.symbol).toBe("fUSDC");
    expect(folks?.name).toMatch(/Folks/i);
  });
});
