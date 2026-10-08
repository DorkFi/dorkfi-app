import { describe, expect, it } from "vitest";
import {
  circulatingLstSupply,
  lpAtomicToHuman,
  mythPoolSharePercent,
} from "@/services/mythLiquidityService";

describe("circulatingLstSupply", () => {
  it("subtracts the dualSTAKE reserve from total ASA supply", () => {
    expect(circulatingLstSupply(10_000n, 7_500n)).toBe(2_500n);
  });

  it("clamps to zero when reserve covers total", () => {
    expect(circulatingLstSupply(100n, 100n)).toBe(0n);
    expect(circulatingLstSupply(100n, 250n)).toBe(0n);
  });
});

describe("mythPoolSharePercent", () => {
  it("returns wallet LST as a percent of circulating supply", () => {
    expect(mythPoolSharePercent(1_000_000n, 2_500n)).toBe(0.25);
  });

  it("is zero without circulating supply or wallet LST", () => {
    expect(mythPoolSharePercent(0n, 1n)).toBe(0);
    expect(mythPoolSharePercent(100n, 0n)).toBe(0);
  });
});

describe("lpAtomicToHuman", () => {
  it("scales 6-decimal LST amounts", () => {
    expect(lpAtomicToHuman(1_500_000n, 6)).toBe(1.5);
  });
});
