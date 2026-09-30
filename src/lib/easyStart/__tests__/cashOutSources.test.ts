import { describe, expect, it } from "vitest";
import {
  cashOutNeedsMove,
  cashOutSourceOptions,
  cashOutSourcesWithLaunch,
  defaultCashOutSource,
} from "@/lib/easyStart/cashOutSources";

describe("cashOutSourceOptions", () => {
  it("lists every bucket above the cash-out floor", () => {
    expect(
      cashOutSourceOptions({ baseUsd: 12, earnUsd: 40, algorandUsd: 0 })
    ).toEqual([
      { source: "base", usd: 12 },
      { source: "earn", usd: 40 },
    ]);
  });

  it("drops dust", () => {
    expect(
      cashOutSourceOptions({ baseUsd: 0.01, earnUsd: 0, algorandUsd: 8 })
    ).toEqual([{ source: "algorand", usd: 8 }]);
  });
});

describe("defaultCashOutSource", () => {
  it("prefers Base when it can be sent now", () => {
    const options = cashOutSourceOptions({
      baseUsd: 5,
      earnUsd: 80,
      algorandUsd: 3,
    });
    expect(defaultCashOutSource(options)).toBe("base");
  });

  it("uses Earn when Base is empty", () => {
    const options = cashOutSourceOptions({
      baseUsd: 0,
      earnUsd: 20,
      algorandUsd: 4,
    });
    expect(defaultCashOutSource(options)).toBe("earn");
  });

  it("honors a launch source that is actually funded", () => {
    const options = cashOutSourceOptions({
      baseUsd: 9,
      earnUsd: 0,
      algorandUsd: 15,
    });
    expect(defaultCashOutSource(options, "algorand")).toBe("algorand");
  });
});

describe("cashOutSourcesWithLaunch", () => {
  it("keeps a just-borrowed Algorand amount before the balance query refreshes", () => {
    const options = cashOutSourcesWithLaunch([], {
      source: "algorand",
      amount: "25",
    });
    expect(options).toEqual([{ source: "algorand", usd: 25 }]);
    expect(cashOutNeedsMove("algorand")).toBe(true);
    expect(cashOutNeedsMove("base")).toBe(false);
  });
});
