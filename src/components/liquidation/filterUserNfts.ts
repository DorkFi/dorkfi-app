import type { UserNFT } from "@/hooks/useUserNFTs";

export function filterUserNfts(nfts: UserNFT[], query: string): UserNFT[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return nfts;

  return nfts.filter(
    (nft) =>
      nft.name.toLowerCase().includes(normalizedQuery) ||
      nft.tokenId.includes(normalizedQuery) ||
      nft.collectionName?.toLowerCase().includes(normalizedQuery)
  );
}
