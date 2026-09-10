import { describe, expect, it } from "vitest";
import { pickMarketsDataForKeys } from "@/hooks/useOnDemandMarketData";

describe("pickMarketsDataForKeys", () => {
  it("keeps only allowed cache keys (drops leaked LP rows)", () => {
    const data = {
      "algo-3333688282": { asset: "Algo" },
      "tmpool2-3585829377-3578405588": { asset: "TMPOOL2" },
      "wad-3585829377": { asset: "WAD" },
    };
    const picked = pickMarketsDataForKeys(data, [
      "algo-3333688282",
      "wad-3585829377",
    ]);
    expect(Object.keys(picked).sort()).toEqual([
      "algo-3333688282",
      "wad-3585829377",
    ]);
    expect(picked["tmpool2-3585829377-3578405588"]).toBeUndefined();
  });

  it("returns empty object when allow-list is empty", () => {
    expect(pickMarketsDataForKeys({ a: 1 }, [])).toEqual({});
  });
});
