import { describe, it, expect } from "vitest";
import { formatMarketCapHuman } from "../lendingService";

describe("formatMarketCapHuman", () => {
  it("preserves sub-1 caps for 8-decimal wBTC markets (issue #492)", () => {
    expect(formatMarketCapHuman("1000000", 8)).toBe("0.0100");
    expect(formatMarketCapHuman("100000", 8)).toBe("0.0010");
  });

  it("formats legacy wBTC caps", () => {
    expect(formatMarketCapHuman("100000000", 8)).toBe("1.0000");
    expect(formatMarketCapHuman("10000000", 8)).toBe("0.1000");
  });

  it("formats 6-decimal stablecoin caps", () => {
    expect(formatMarketCapHuman("1000000000000", 6)).toBe("1000000.0000");
  });
});
