import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coinbaseDepositAddress,
  coinbaseFromAddress,
  coinbaseSellAmount,
  fetchCoinbaseOfframpStatus,
  OfframpStatusForbiddenError,
  parseCoinbaseAmount,
  selectCoinbaseCashOutSale,
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

  it("accepts an Algorand deposit address for an ALGO sell", () => {
    const tx: CoinbaseSellTx = {
      sell_amount: { value: "10", currency: "ALGO" },
      to_address: "47YPQTIGQEO7T4Y4RWDYWEKV6RTR2UNBQXBABEEGM72ESWDQNCQ52OPASU",
      asset: "ALGO",
      network: "algorand",
    };
    expect(coinbaseDepositAddress(tx, "algorand")).toBe(
      "47YPQTIGQEO7T4Y4RWDYWEKV6RTR2UNBQXBABEEGM72ESWDQNCQ52OPASU"
    );
    expect(coinbaseDepositAddress(tx)).toBeNull();
  });

  it("returns null when the transaction is missing", () => {
    expect(coinbaseSellAmount(null)).toBeNull();
    expect(coinbaseDepositAddress(null)).toBeNull();
    expect(coinbaseFromAddress(null)).toBeNull();
  });
});

const ALGO = "47YPQTIGQEO7T4Y4RWDYWEKV6RTR2UNBQXBABEEGM72ESWDQNCQ52OPASU";
const OTHER_ALGO = "VCMJKWOY5P5P7SKMZFFOCEROPJCZOTIJMNIYNUCKH7LRO45JMJP6UYBIJA";
const BASE = "0x0b59d1001629c86da136a0B480Db68EDBf70e222";

describe("selectCoinbaseCashOutSale", () => {
  const openSale = {
    status: "TRANSACTION_STATUS_STARTED",
    sell_amount: { value: "12.5", currency: "ALGO" },
    to_address: ALGO,
    from_address: ALGO,
  } satisfies CoinbaseSellTx;

  it("waits when the sell amount, from_address, or stored amount is missing", () => {
    expect(
      selectCoinbaseCashOutSale({
        transactions: [{ ...openSale, sell_amount: undefined }],
        kind: "algorand",
        connectedAddress: ALGO,
        expectedAmount: "12.5",
      }).action
    ).toBe("wait");
    expect(
      selectCoinbaseCashOutSale({
        transactions: [{ ...openSale, from_address: undefined }],
        kind: "algorand",
        connectedAddress: ALGO,
        expectedAmount: "12.5",
      }).action
    ).toBe("wait");
    expect(
      selectCoinbaseCashOutSale({
        transactions: [openSale],
        kind: "algorand",
        connectedAddress: ALGO,
        expectedAmount: null,
      }).action
    ).toBe("wait");
    expect(coinbaseFromAddress({ to_address: ALGO })).toBeNull();
  });

  it("keeps polling when an older row has a different from_address", () => {
    expect(
      selectCoinbaseCashOutSale({
        transactions: [{ ...openSale, from_address: OTHER_ALGO }],
        kind: "algorand",
        connectedAddress: ALGO,
        expectedAmount: "12.5",
      })
    ).toEqual({ action: "wait" });
  });

  it("skips a finished sale and confirms the open sale with the stored amount", () => {
    const decision = selectCoinbaseCashOutSale({
      transactions: [
        {
          status: "TRANSACTION_STATUS_SUCCESS",
          sell_amount: { value: "12.5", currency: "ALGO" },
          to_address: OTHER_ALGO,
          from_address: OTHER_ALGO,
          tx_hash: "OLD",
        },
        openSale,
      ],
      kind: "algorand",
      connectedAddress: ALGO,
      expectedAmount: "12.50",
    });
    expect(decision).toEqual({
      action: "confirm",
      to: ALGO,
      amount: "12.5",
    });
  });

  it("waits when the open sale amount differs from the amount started", () => {
    expect(
      selectCoinbaseCashOutSale({
        transactions: [openSale],
        kind: "algorand",
        connectedAddress: ALGO,
        expectedAmount: "1",
      })
    ).toEqual({ action: "wait" });
  });

  it("waits when the matching sale already has a transaction hash", () => {
    expect(
      selectCoinbaseCashOutSale({
        transactions: [{ ...openSale, tx_hash: "ALREADY_SENT" }],
        kind: "algorand",
        connectedAddress: ALGO,
        expectedAmount: "12.5",
      }).action
    ).toBe("wait");
  });

  it("matches a Base from_address case-insensitively", () => {
    const decision = selectCoinbaseCashOutSale({
      transactions: [
        {
          status: "TRANSACTION_STATUS_CREATED",
          sell_amount: "25.00",
          to_address: BASE,
          from_address: BASE.toUpperCase(),
        },
      ],
      kind: "evm",
      connectedAddress: BASE.toLowerCase(),
      expectedAmount: "25",
    });
    expect(decision).toEqual({
      action: "confirm",
      to: BASE,
      amount: "25.00",
    });
  });
});

describe("fetchCoinbaseOfframpStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats HTTP 403 as a forbidden status and does not return a sale", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }))
    );
    await expect(fetchCoinbaseOfframpStatus("privy-other", "token")).rejects.toBeInstanceOf(
      OfframpStatusForbiddenError
    );
  });
});
