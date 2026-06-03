import { describe, expect, it } from "vitest";
import { resolveLpTokenPairIcons } from "@/utils/lpTokenIconUtils";

const NETWORK = "algorand-mainnet" as const;

describe("resolveLpTokenPairIcons", () => {
  it("resolves pair icons for LP_TMPOOL2_WAD_UNIT", () => {
    const icons = resolveLpTokenPairIcons(NETWORK, {
      configSymbol: "LP_TMPOOL2_WAD_UNIT",
    });
    expect(icons).toEqual({
      asset1Icon: "/lovable-uploads/WAD_fixed.png",
      asset2Icon: "/lovable-uploads/UNIT.png",
    });
  });

  it("resolves pair icons by lpTokenId", () => {
    const icons = resolveLpTokenPairIcons(NETWORK, {
      lpTokenId: 3157974960,
    });
    expect(icons).toEqual({
      asset1Icon: "/lovable-uploads/UNIT.png",
      asset2Icon: "/lovable-uploads/Algo.webp",
    });
  });

  it("resolves WAD/USDC pair icons from curated pool metadata", () => {
    const icons = resolveLpTokenPairIcons(NETWORK, { lpTokenId: 3334448440 });
    expect(icons).toEqual({
      asset1Icon: "/lovable-uploads/WAD_fixed.png",
      asset2Icon: "/lovable-uploads/USDC.webp",
    });
  });

  it("returns null for unconfigured LP config keys", () => {
    expect(
      resolveLpTokenPairIcons(NETWORK, {
        configSymbol: "LP_TMPOOL2_WAD_USDC",
      })
    ).toBeNull();
  });

  it("returns null for non-LP config keys", () => {
    expect(
      resolveLpTokenPairIcons(NETWORK, { configSymbol: "WAD" })
    ).toBeNull();
  });
});
