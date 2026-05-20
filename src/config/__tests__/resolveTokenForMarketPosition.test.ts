import { describe, expect, it } from "vitest";
import { resolveTokenForMarketPosition } from "@/config";

describe("resolveTokenForMarketPosition", () => {
  it("resolves UNIT on prod primary pool", () => {
    const t = resolveTokenForMarketPosition("voi-mainnet", {
      asset: "UNIT",
      poolId: "47139778",
    });
    expect(t).not.toBeNull();
    expect(t?.poolId).toBe("47139778");
    expect(t?.underlyingContractId).toBe("420069");
  });

  it("resolves UNIT on legacy migration pool A", () => {
    const t = resolveTokenForMarketPosition("voi-mainnet", {
      asset: "UNIT",
      poolId: "41760711",
    });
    expect(t).not.toBeNull();
    expect(t?.poolId).toBe("41760711");
    expect(t?.underlyingContractId).toBe("420069");
  });
});
