import { describe, expect, it } from "vitest";
import { selectBestXoRate } from "@/lib/easyStart/xoSwap/selectRate";
import type { XoRate } from "@/lib/easyStart/xoSwap/types";

function rate(partial: Partial<XoRate> & { multiplier: number }): XoRate {
  return {
    amount: { value: partial.multiplier },
    minerFee: partial.minerFee ?? { value: 0 },
    min: partial.min ?? { value: 1 },
    max: partial.max ?? { value: 10_000 },
    expiry: partial.expiry,
  };
}

describe("selectBestXoRate", () => {
  it("picks the highest output within min/max", () => {
    const best = selectBestXoRate(
      [
        rate({ multiplier: 0.99, minerFee: { value: 0.5 } }),
        rate({ multiplier: 0.995, minerFee: { value: 0.1 } }),
      ],
      100,
      0
    );
    expect(best?.toAmount).toBeCloseTo(100 * 0.995 - 0.1);
  });

  it("skips expired and out-of-range rates", () => {
    const best = selectBestXoRate(
      [
        rate({ multiplier: 1, min: { value: 500 }, max: { value: 1000 } }),
        rate({ multiplier: 0.9, expiry: 1 }),
        rate({ multiplier: 0.98, minerFee: { value: 0 } }),
      ],
      100,
      10
    );
    expect(best?.toAmount).toBeCloseTo(98);
  });
});
