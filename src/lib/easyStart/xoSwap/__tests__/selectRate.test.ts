import { describe, expect, it } from "vitest";
import { selectBestXoRate, xoRateBounds } from "@/lib/easyStart/xoSwap/selectRate";
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

  it("returns the live min/max envelope", () => {
    const bounds = xoRateBounds(
      [
        rate({ multiplier: 0.99, min: { value: 5 }, max: { value: 50 } }),
        rate({ multiplier: 0.98, min: { value: 20 }, max: { value: 200 } }),
        rate({
          multiplier: 1,
          min: { value: 1 },
          max: { value: 10_000 },
          expiry: 1,
        }),
      ],
      10
    );
    expect(bounds).toEqual({ min: 5, max: 200 });
  });
});
