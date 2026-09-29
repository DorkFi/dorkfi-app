import { describe, expect, it } from "vitest";
import {
  marketRowAfterFailedLoad,
  type OnDemandMarketData,
} from "@/hooks/useOnDemandMarketData";

const loadedRow = {
  asset: "USDC",
  marketInfo: { marketId: "3210682240" },
  isLoaded: true,
  isLoading: true,
} as OnDemandMarketData;

describe("marketRowAfterFailedLoad", () => {
  it("keeps a loaded row when a refresh fails", () => {
    const next = marketRowAfterFailedLoad(
      loadedRow,
      "Failed to load market data"
    );
    expect(next.error).toBeUndefined();
    expect(next.marketInfo).toBe(loadedRow.marketInfo);
    expect(next.isLoading).toBe(false);
    expect(next.asset).toBe("USDC");
  });

  it("records the error when the row has no snapshot yet", () => {
    const next = marketRowAfterFailedLoad(
      undefined,
      "Failed to load market data"
    );
    expect(next.error).toBe("Failed to load market data");
    expect(next.isLoaded).toBe(true);
    expect(next.isLoading).toBe(false);
    expect(next.marketInfo).toBeUndefined();
  });
});
