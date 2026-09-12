import { describe, expect, it, vi } from "vitest";
import { BASE_MAINNET_USDC } from "@/lib/easyStart/baseBalances";
import { sendBaseUsdc } from "@/lib/easyStart/sendBaseUsdc";

describe("sendBaseUsdc", () => {
  it("passes fromAddress to Privy sendTransaction options", async () => {
    const sendTransaction = vi.fn().mockResolvedValue({ hash: "0xabc" });
    const from = "0x1111111111111111111111111111111111111111";
    const to = "0x2222222222222222222222222222222222222222";

    await sendBaseUsdc({
      sendTransaction,
      to,
      amount: "18.5",
      fromAddress: from,
    });

    expect(sendTransaction).toHaveBeenCalledTimes(1);
    const [input, options] = sendTransaction.mock.calls[0];
    expect(input.to).toBe(BASE_MAINNET_USDC);
    expect(input.chainId).toBe(8453);
    expect(input.value).toBe(0n);
    expect(options).toEqual({ address: from });
  });

  it("omits options when fromAddress is missing", async () => {
    const sendTransaction = vi.fn().mockResolvedValue({ hash: "0xabc" });
    await sendBaseUsdc({
      sendTransaction,
      to: "0x2222222222222222222222222222222222222222",
      amount: "1",
    });
    expect(sendTransaction.mock.calls[0][1]).toBeUndefined();
  });
});
