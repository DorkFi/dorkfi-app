import { describe, expect, it } from "vitest";
import { getTokenConfig } from "@/config";

describe("Algorand ALGO pool rows", () => {
  it("uses distinct nToken ids for pool A and pool B (#646)", () => {
    const algo = getTokenConfig("algorand-mainnet", "ALGO");
    expect(Array.isArray(algo)).toBe(true);
    const rows = Array.isArray(algo) ? algo : [];
    const poolA = rows.find((t) => String(t.poolId) === "3333688282");
    const poolB = rows.find((t) => String(t.poolId) === "3345940978");
    expect(poolA?.contractId).toBe("3207744109");
    expect(poolB?.contractId).toBe("3207744109");
    expect(poolA?.nTokenId).toBe("3333724131");
    expect(poolB?.nTokenId).toBe("3493601964");
    expect(poolA?.nTokenId).not.toBe(poolB?.nTokenId);
  });
});
