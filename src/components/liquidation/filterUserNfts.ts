import type { UserNFT } from "@/hooks/useUserNFTs";

export function filterUserNfts(nfts: UserNFT[], query: string): UserNFT[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return nfts;

  return nfts.filter((nft) => {
    const name = nft.name?.toLowerCase() ?? "";
    const tokenId = nft.tokenId ?? "";
    const collectionName = nft.collectionName?.toLowerCase() ?? "";

    return (
      name.includes(normalizedQuery) ||
      tokenId.toLowerCase().includes(normalizedQuery) ||
      collectionName.includes(normalizedQuery)
    );
  });
}
