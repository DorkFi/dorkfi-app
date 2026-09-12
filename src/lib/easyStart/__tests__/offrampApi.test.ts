import { describe, expect, it } from "vitest";
import {
  coinbaseDepositAddress,
  coinbaseSellAmount,
  parseCoinbaseAmount,
  type CoinbaseSellTx,
} from "@/lib/easyStart/offrampApi";

describe("parseCoinbaseAmount", () => {
  it("reads CDP { value, currency } objects", () => {
    expect(parseCoinbaseAmount({ value: "18.5", currency: "USDC" })).toBe(
      "18.5"
    );
  });

  it("reads numeric strings and numbers", () => {
    expect(parseCoinbaseAmount("10")).toBe("10");
    expect(parseCoinbaseAmount(12.5)).toBe("12.5");
  });

  it("rejects Object.prototype stringification and invalid values", () => {
    expect(parseCoinbaseAmount("[object Object]")).toBeNull();
    expect(parseCoinbaseAmount({ currency: "USDC" })).toBeNull();
    expect(parseCoinbaseAmount("0")).toBeNull();
    expect(parseCoinbaseAmount(-1)).toBeNull();
    expect(parseCoinbaseAmount(null)).toBeNull();
  });
});

describe("coinbaseSellAmount / coinbaseDepositAddress", () => {
  it("prefers sell_amount objects from the status API example", () => {
    const tx: CoinbaseSellTx = {
      sell_amount: { value: "0.005", currency: "ETH" },
      toAddress: "0x0b59d1001629c86da136a0B480Db68EDBf70e222",
    };
    expect(coinbaseSellAmount(tx)).toBe("0.005");
    expect(coinbaseDepositAddress(tx)).toBe(
      "0x0b59d1001629c86da136a0B480Db68EDBf70e222"
    );
  });

  it("accepts snake_case address and string amount", () => {
    const tx: CoinbaseSellTx = {
      sell_amount: "25.00",
      to_address: "0x1234567890abcdef1234567890abcdef12345678",
    };
    expect(coinbaseSellAmount(tx)).toBe("25.00");
    expect(coinbaseDepositAddress(tx)).toBe(
      "0x1234567890abcdef1234567890abcdef12345678"
    );
  });

  it("returns null when the transaction is missing", () => {
    expect(coinbaseSellAmount(null)).toBeNull();
    expect(coinbaseDepositAddress(null)).toBeNull();
  });
});
