import { describe, expect, it, vi } from "vitest";
import { quoteWithOutputAssetOptIn } from "@/services/haystackRouter";
import type { SwapQuote } from "@txnlab/haystack-router";

const BASE_QUOTE = {
  quote: 1n,
  amount: 1_000_000n,
  fromASAID: 0,
  toASAID: 31_566_704,
  type: "fixed-input",
  createdAt: 1,
} as unknown as SwapQuote;

describe("quoteWithOutputAssetOptIn", () => {
  it("keeps the existing quote when swapping to ALGO", async () => {
    const newQuote = vi.fn();
    const result = await quoteWithOutputAssetOptIn({
      client: {
        needsAssetOptIn: vi.fn(),
        newQuote,
      },
      quote: BASE_QUOTE,
      address: "SWAPPER",
      fromASAID: 31_566_704,
      toASAID: 0,
      amount: 1_000_000n,
    });
    expect(result).toBe(BASE_QUOTE);
    expect(newQuote).not.toHaveBeenCalled();
  });

  it("keeps the existing quote when the swapper already holds the output ASA", async () => {
    const newQuote = vi.fn();
    const result = await quoteWithOutputAssetOptIn({
      client: {
        needsAssetOptIn: vi.fn().mockResolvedValue(false),
        newQuote,
      },
      quote: BASE_QUOTE,
      address: "SWAPPER",
      fromASAID: 0,
      toASAID: 31_566_704,
      amount: 1_000_000n,
    });
    expect(result).toBe(BASE_QUOTE);
    expect(newQuote).not.toHaveBeenCalled();
  });

  it("requotes with optIn when the swapper is missing the output ASA", async () => {
    const requote = { ...BASE_QUOTE, createdAt: 2 } as unknown as SwapQuote;
    const newQuote = vi.fn().mockResolvedValue(requote);
    const result = await quoteWithOutputAssetOptIn({
      client: {
        needsAssetOptIn: vi.fn().mockResolvedValue(true),
        newQuote,
      },
      quote: BASE_QUOTE,
      address: "SWAPPER",
      fromASAID: 0,
      toASAID: 31_566_704,
      amount: 1_000_000n,
    });
    expect(result).toBe(requote);
    expect(newQuote).toHaveBeenCalledWith({
      fromASAID: 0,
      toASAID: 31_566_704,
      amount: 1_000_000n,
      type: "fixed-input",
      address: "SWAPPER",
      optIn: true,
    });
  });
});
