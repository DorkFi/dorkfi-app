import { describe, expect, it } from "vitest";
import { filterUserNfts } from "../filterUserNfts";
import type { UserNFT } from "@/hooks/useUserNFTs";

const sampleNfts: UserNFT[] = [
  {
    contractId: 313597,
    tokenId: "12",
    name: "DORK 12",
    imageUrl: "https://example.com/dork-12.png",
    collectionName: "Dorks v1",
  },
  {
    contractId: 313705,
    tokenId: "3",
    name: "CHUB 3",
    imageUrl: "https://example.com/chub-3.png",
    collectionName: "Lil Chubs",
  },
];

describe("filterUserNfts", () => {
  it("returns all NFTs when the query is empty", () => {
    expect(filterUserNfts(sampleNfts, "")).toEqual(sampleNfts);
    expect(filterUserNfts(sampleNfts, "   ")).toEqual(sampleNfts);
  });

  it("filters by name, token id, or collection name", () => {
    expect(filterUserNfts(sampleNfts, "chub")).toEqual([sampleNfts[1]]);
    expect(filterUserNfts(sampleNfts, "12")).toEqual([sampleNfts[0]]);
    expect(filterUserNfts(sampleNfts, "dorks v1")).toEqual([sampleNfts[0]]);
  });

  it("is case-insensitive for name and collection search", () => {
    expect(filterUserNfts(sampleNfts, "CHUB")).toEqual([sampleNfts[1]]);
    expect(filterUserNfts(sampleNfts, "Chub")).toEqual([sampleNfts[1]]);
    expect(filterUserNfts(sampleNfts, "cHuB")).toEqual([sampleNfts[1]]);
    expect(filterUserNfts(sampleNfts, "DORK")).toEqual([sampleNfts[0]]);
    expect(filterUserNfts(sampleNfts, "dork")).toEqual([sampleNfts[0]]);
    expect(filterUserNfts(sampleNfts, "DORKS V1")).toEqual([sampleNfts[0]]);
    expect(filterUserNfts(sampleNfts, "lil chubs")).toEqual([sampleNfts[1]]);
    expect(filterUserNfts(sampleNfts, "LIL CHUBS")).toEqual([sampleNfts[1]]);
  });

  it("tolerates missing name or collection fields", () => {
    const incomplete = [
      {
        contractId: 1,
        tokenId: "99",
        name: undefined as unknown as string,
        imageUrl: "",
        collectionName: undefined,
      },
    ];
    expect(filterUserNfts(incomplete, "99")).toEqual(incomplete);
    expect(filterUserNfts(incomplete, "missing")).toEqual([]);
  });
});
