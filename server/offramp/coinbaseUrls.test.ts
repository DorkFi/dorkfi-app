import { describe, expect, it } from "vitest";
import {
  buildCoinbaseOfframpSellUrl,
  buildCoinbaseOnrampBuyUrl,
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
});

describe("buildCoinbaseOfframpSellUrl", () => {
  it("keeps the existing sell widget URL", () => {
    const url = new URL(buildCoinbaseOfframpSellUrl(args));
    expect(url.origin + url.pathname).toBe(
      "https://pay.coinbase.com/v3/sell/input"
    );
    expect(url.searchParams.get("presetCryptoAmount")).toBe("100");
    expect(url.searchParams.get("presetFiatAmount")).toBeNull();
  });
});
