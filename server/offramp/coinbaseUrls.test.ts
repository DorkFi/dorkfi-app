import { describe, expect, it } from "vitest";
import {
  buildCoinbaseOfframpSellUrl,
  buildCoinbaseOnrampBuyUrl,
  COINBASE_ALGORAND_ALGO,
  coinbaseSessionTokenBody,
  parseCoinbaseOfframpReturnSearch,
  withCoinbaseOfframpReturnQuery,
} from "./coinbaseUrls";

const args = {
  sessionToken: "sess_test_token",
  partnerUserRef: "df-aabbccdd-xyz",
  redirectUrl: "https://beta.simplfi.xyz/portfolio",
  amount: "100",
};

describe("buildCoinbaseOnrampBuyUrl", () => {
  it("builds the hosted buy URL Coinbase Full Access reviewers verify", () => {
    const url = new URL(buildCoinbaseOnrampBuyUrl(args));
    expect(url.origin + url.pathname).toBe(
      "https://pay.coinbase.com/buy/select-asset"
    );
    expect(url.searchParams.get("sessionToken")).toBe("sess_test_token");
    expect(url.searchParams.get("defaultNetwork")).toBe("base");
    expect(url.searchParams.get("defaultAsset")).toBe("USDC");
    expect(url.searchParams.get("fiatCurrency")).toBe("USD");
    expect(url.searchParams.get("defaultExperience")).toBe("buy");
    expect(url.searchParams.get("presetFiatAmount")).toBe("100");
    expect(url.searchParams.get("partnerUserRef")).toBe("df-aabbccdd-xyz");
    expect(url.searchParams.get("redirectUrl")).toBe(
      "https://beta.simplfi.xyz/portfolio"
    );
  });

  it("builds an Algorand ALGO buy for the xChain account", () => {
    const url = new URL(
      buildCoinbaseOnrampBuyUrl(args, COINBASE_ALGORAND_ALGO)
    );
    expect(url.searchParams.get("defaultNetwork")).toBe("algorand");
    expect(url.searchParams.get("defaultAsset")).toBe("ALGO");
    expect(url.searchParams.get("defaultExperience")).toBe("buy");
    expect(
      coinbaseSessionTokenBody({
        address: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        clientIp: "203.0.113.8",
        target: COINBASE_ALGORAND_ALGO,
      })
    ).toEqual({
      addresses: [
        {
          address: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          blockchains: ["algorand"],
        },
      ],
      clientIp: "203.0.113.8",
      assets: ["ALGO"],
    });
  });
});

describe("buildCoinbaseOfframpSellUrl", () => {
  it("keeps the existing sell widget URL", () => {
    const url = new URL(buildCoinbaseOfframpSellUrl(args));
    expect(url.origin + url.pathname).toBe(
      "https://pay.coinbase.com/v3/sell/input"
    );
    expect(url.searchParams.get("defaultNetwork")).toBe("base");
    expect(url.searchParams.get("defaultAsset")).toBe("USDC");
    expect(url.searchParams.get("presetCryptoAmount")).toBe("100");
    expect(url.searchParams.get("presetFiatAmount")).toBeNull();
    expect(url.searchParams.get("defaultCashoutMethod")).toBeNull();
  });

  it("sells Algorand ALGO to a bank or a Coinbase account", () => {
    const bank = new URL(
      buildCoinbaseOfframpSellUrl(args, COINBASE_ALGORAND_ALGO, "ACH_BANK_ACCOUNT")
    );
    expect(bank.searchParams.get("defaultNetwork")).toBe("algorand");
    expect(bank.searchParams.get("defaultAsset")).toBe("ALGO");
    expect(bank.searchParams.get("defaultCashoutMethod")).toBe("ACH_BANK_ACCOUNT");
    expect(bank.searchParams.get("presetCryptoAmount")).toBe("100");

    const coinbase = new URL(
      buildCoinbaseOfframpSellUrl(args, COINBASE_ALGORAND_ALGO, "CRYPTO_ACCOUNT")
    );
    expect(coinbase.searchParams.get("defaultCashoutMethod")).toBe(
      "CRYPTO_ACCOUNT"
    );
  });

  it("sends cash-out back to /portfolio with resume query params", () => {
    const redirectUrl = withCoinbaseOfframpReturnQuery(
      args.redirectUrl,
      args.partnerUserRef
    );
    const url = new URL(
      buildCoinbaseOfframpSellUrl({ ...args, redirectUrl })
    );
    expect(url.searchParams.get("redirectUrl")).toBe(redirectUrl);
    expect(parseCoinbaseOfframpReturnSearch(new URL(redirectUrl).search)).toEqual(
      { partnerUserRef: args.partnerUserRef }
    );
  });
});

describe("withCoinbaseOfframpReturnQuery", () => {
  it("tags the SimplFi return URL so cash-out can resume after Coinbase", () => {
    const next = withCoinbaseOfframpReturnQuery(
      "https://beta.simplfi.xyz/portfolio",
      "privy-user-1"
    );
    expect(parseCoinbaseOfframpReturnSearch(new URL(next).search)).toEqual({
      partnerUserRef: "privy-user-1",
    });
    expect(new URL(next).pathname).toBe("/portfolio");
  });

  it("returns null when the resume flag is missing", () => {
    expect(parseCoinbaseOfframpReturnSearch("?ref=privy-user-1")).toBeNull();
  });
});
