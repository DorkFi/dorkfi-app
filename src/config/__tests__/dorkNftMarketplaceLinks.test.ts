import { describe, expect, it } from "vitest";
import {
  getDorkNftMarketplaceLinks,
  getVoiNautilusCollectionTradeUrl,
} from "../dorkNftMarketplaceLinks";

describe("getDorkNftMarketplaceLinks", () => {
  it("returns DownBad links in Dorks, Chubs, Dorks V2 order on Algorand mainnet", () => {
    const links = getDorkNftMarketplaceLinks("algorand-mainnet");

    expect(links).toHaveLength(3);
    expect(links.map((link) => link.label)).toEqual(["Dorks", "Chubs", "Dorks V2"]);
    expect(links.map((link) => link.url)).toEqual([
      "https://www.downbad.farm/collection/dorks",
      "https://www.downbad.farm/collection/chub",
      "https://www.downbad.farm/collection/dorks-v2",
    ]);
    expect(links.map((link) => link.imageUrl)).toEqual([
      "/lovable-uploads/dorks-collection-preview.png",
      "/lovable-uploads/chubs-collection-preview.png",
      "/lovable-uploads/dorks-v2-collection-preview.png",
    ]);
  });

  it("returns app.nautilus.sh links in Dorks, Chubs, Dorks V2 order on Voi mainnet", () => {
    const links = getDorkNftMarketplaceLinks("voi-mainnet");

    expect(links).toHaveLength(3);
    expect(links.map((link) => link.label)).toEqual(["Dorks", "Chubs", "Dorks V2"]);
    expect(links.every((link) => link.url.startsWith("https://app.nautilus.sh/"))).toBe(
      true
    );
    expect(links.map((link) => link.url)).toEqual([
      "https://app.nautilus.sh/#/collection/313597/trade",
      "https://app.nautilus.sh/#/collection/313705/trade",
      "https://app.nautilus.sh/#/collection/894888/trade",
    ]);
  });
});

describe("getVoiNautilusCollectionTradeUrl", () => {
  it("builds a trade URL for the given contract id", () => {
    expect(getVoiNautilusCollectionTradeUrl(313597)).toBe(
      "https://app.nautilus.sh/#/collection/313597/trade"
    );
  });
});
