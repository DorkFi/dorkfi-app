import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchXoPairQuote, fetchXoPairRates } from "@/lib/easyStart/xoSwap/api";
import { quoteXoPair } from "@/lib/easyStart/xoSwap/quotePair";
import type { XoRate } from "@/lib/easyStart/xoSwap/types";

vi.mock("@/lib/easyStart/xoSwap/api", () => ({
  fetchXoPairRates: vi.fn(),
  fetchXoPairQuote: vi.fn(),
}));

const fetchRates = vi.mocked(fetchXoPairRates);
const fetchQuote = vi.mocked(fetchXoPairQuote);

function rate(partial: Partial<XoRate> & { multiplier: number }): XoRate {
  return {
    amount: { value: partial.multiplier },
    minerFee: partial.minerFee ?? { value: 0.1 },
    min: partial.min ?? { value: 10 },
    max: partial.max ?? { value: 1_000 },
    expiry: partial.expiry,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("quoteXoPair", () => {
  it("returns the best fixed receive amount", async () => {
    fetchRates.mockResolvedValue([
      rate({ multiplier: 0.99, minerFee: { value: 0.2 } }),
    ]);
    const preview = await quoteXoPair("USDCbasemainnetB5A52617_USDCALGO", 100);
    expect(preview.toAmount).toBeCloseTo(100 * 0.99 - 0.2);
    expect(preview.inRange).toBe(true);
    expect(preview.useFloating).toBe(false);
    expect(preview.min).toBe(10);
    expect(preview.max).toBe(1_000);
    expect(fetchQuote).not.toHaveBeenCalled();
  });

  it("does not float when the amount is below min", async () => {
    fetchRates.mockResolvedValue([rate({ multiplier: 0.99 })]);
    const preview = await quoteXoPair("USDCbasemainnetB5A52617_USDCALGO", 1);
    expect(preview.inRange).toBe(false);
    expect(preview.toAmount).toBeNull();
    expect(preview.min).toBe(10);
    expect(fetchQuote).not.toHaveBeenCalled();
  });

  it("falls back to a floating quote when rates fail", async () => {
    fetchRates.mockRejectedValue(new Error("rates down"));
    fetchQuote.mockResolvedValue({
      toAmount: { value: 97.4 },
      minerFee: { value: 0.3 },
    });
    const preview = await quoteXoPair("USDCbasemainnetB5A52617_USDCALGO", 100);
    expect(preview.toAmount).toBe(97.4);
    expect(preview.useFloating).toBe(true);
    expect(preview.minerFee).toBe(0.3);
  });

  it("surfaces geo restriction instead of quoting", async () => {
    fetchRates.mockRejectedValue(new Error("RESTRICTED_GEOLOCATION"));
    await expect(
      quoteXoPair("USDCbasemainnetB5A52617_USDCALGO", 100)
    ).rejects.toThrow(/region/i);
    expect(fetchQuote).not.toHaveBeenCalled();
  });
});
