import { describe, expect, it } from "vitest";
import {
  isDisplayUsdNetwork,
  overlayUsdWithDisplayPrice,
  parseAsaIdForDisplay,
  resolveDisplayUsdPerToken,
  scaleUsdAmountWithDisplayPrice,
} from "@/utils/displayUsdPerToken";

describe("parseAsaIdForDisplay", () => {
  it("uses this asset's DEX USD when present", () => {
    expect(
      resolveDisplayUsdPerToken({ dexUsd: 76_124, protocolUsd: 60_725 })
    ).toBe(76_124);
  });

  it("falls back to this market's protocol USD when DEX is missing", () => {
    expect(
      resolveDisplayUsdPerToken({ dexUsd: null, protocolUsd: 60_725 })
    ).toBe(60_725);
  });

  it("returns 0 when both sources are invalid", () => {
    expect(resolveDisplayUsdPerToken({ dexUsd: 0, protocolUsd: NaN })).toBe(0);
  });

  it("never prefers a zero DEX over protocol", () => {
    expect(
      resolveDisplayUsdPerToken({ dexUsd: 0, protocolUsd: 72_793 })
    ).toBe(72_793);
  });
});

describe("parseAsaIdForDisplay", () => {
  it("accepts ALGO (0) and goBTC", () => {
    expect(parseAsaIdForDisplay("0")).toBe(0);
    expect(parseAsaIdForDisplay("386192725")).toBe(386192725);
  });

  it("rejects non-numeric ids", () => {
    expect(parseAsaIdForDisplay("goBTC")).toBeNull();
    expect(parseAsaIdForDisplay("")).toBeNull();
  });
});

describe("overlayUsdWithDisplayPrice", () => {
  it("keeps goBTC and wBTC independent", () => {
    const goBtc = overlayUsdWithDisplayPrice(60_725, 76_124);
    const wBtc = overlayUsdWithDisplayPrice(75_440, 72_793);
    expect(goBtc).toBe(76_124);
    expect(wBtc).toBe(72_793);
    expect(goBtc).not.toBe(wBtc);
  });
});

describe("scaleUsdAmountWithDisplayPrice", () => {
  it("reprices goBTC TVL from this asset's DEX, not wBTC", () => {
    const protocolTvl = 0.536955 * 60_725;
    const overlayed = scaleUsdAmountWithDisplayPrice(
      protocolTvl,
      60_725,
      76_124
    );
    expect(overlayed).toBeCloseTo(0.536955 * 76_124, 5);
    expect(overlayed).not.toBeCloseTo(0.536955 * 72_793, 0);
  });

  it("keeps protocol USD when DEX is missing", () => {
    expect(scaleUsdAmountWithDisplayPrice(1_000, 60_725, null)).toBe(1_000);
  });
});

describe("isDisplayUsdNetwork", () => {
  it("is Algorand mainnet only", () => {
    expect(isDisplayUsdNetwork("algorand-mainnet")).toBe(true);
    expect(isDisplayUsdNetwork("voi-mainnet")).toBe(false);
    expect(isDisplayUsdNetwork("algorand-testnet")).toBe(false);
    expect(isDisplayUsdNetwork(null)).toBe(false);
  });
});
