import { describe, expect, it } from "vitest";
import { overlayPositionsDisplayUsd } from "@/utils/overlayPositionDisplayUsd";
import { resolveAsaIdForDisplayUsd } from "@/utils/resolveAsaIdForDisplayUsd";

describe("resolveAsaIdForDisplayUsd", () => {
  it("resolves goBTC and wBTC to different ASAs", () => {
    const goBtc = resolveAsaIdForDisplayUsd({
      networkId: "algorand-mainnet",
      poolId: "3333688282",
      marketId: "3211820549",
      configKey: "goBTC",
      displaySymbol: "goBTC",
    });
    const wBtc = resolveAsaIdForDisplayUsd({
      networkId: "algorand-mainnet",
      poolId: "3333688282",
      marketId: "3211827406",
      configKey: "wBTC",
      displaySymbol: "wBTC",
    });
    expect(goBtc).toBe(386192725);
    expect(wBtc).toBe(1058926737);
    expect(goBtc).not.toBe(wBtc);
  });

  it("does not resolve VOI native to ALGO ASA 0", () => {
    expect(
      resolveAsaIdForDisplayUsd({
        networkId: "voi-mainnet",
        poolId: "41760711",
        marketId: "41877720",
        configKey: "VOI",
        displaySymbol: "VOI",
      })
    ).toBeNull();
  });
});

describe("overlayPositionsDisplayUsd", () => {
  it("revalues goBTC from its own DEX map entry, not wBTC", () => {
    const dex = new Map<number, number>([
      [386192725, 76_124],
      [1058926737, 72_793],
    ]);
    const [goBtc] = overlayPositionsDisplayUsd(
      [
        {
          asset: "goBTC",
          configSymbol: "goBTC",
          network: "algorand-mainnet",
          poolId: "3333688282",
          marketId: "3211820549",
          balance: 0.5,
          tokenPrice: 60_725,
          value: 0.5 * 60_725,
        },
      ],
      dex
    );
    expect(goBtc.tokenPrice).toBe(76_124);
    expect(goBtc.value).toBeCloseTo(0.5 * 76_124, 5);
  });

  it("does not reprice a VOI position from Tinyman ALGO (ASA 0)", () => {
    const dex = new Map<number, number>([[0, 0.0914]]);
    const protocol = 0.012;
    const [voi] = overlayPositionsDisplayUsd(
      [
        {
          asset: "VOI",
          configSymbol: "VOI",
          network: "voi-mainnet",
          poolId: "41760711",
          marketId: "41877720",
          balance: 1000,
          tokenPrice: protocol,
          value: 1000 * protocol,
        },
      ],
      dex
    );
    expect(voi.tokenPrice).toBe(protocol);
    expect(voi.value).toBe(1000 * protocol);
  });

  it("overlays Algorand rows in a mixed list without touching VOI", () => {
    const dex = new Map<number, number>([
      [0, 0.0914],
      [386192725, 76_124],
    ]);
    const [goBtc, voi] = overlayPositionsDisplayUsd(
      [
        {
          asset: "goBTC",
          configSymbol: "goBTC",
          network: "algorand-mainnet",
          poolId: "3333688282",
          marketId: "3211820549",
          balance: 0.5,
          tokenPrice: 60_725,
          value: 0.5 * 60_725,
        },
        {
          asset: "VOI",
          configSymbol: "VOI",
          network: "voi-mainnet",
          poolId: "41760711",
          marketId: "41877720",
          balance: 1000,
          tokenPrice: 0.012,
          value: 12,
        },
      ],
      dex
    );
    expect(goBtc.tokenPrice).toBe(76_124);
    expect(voi.tokenPrice).toBe(0.012);
    expect(voi.value).toBe(12);
  });
});
