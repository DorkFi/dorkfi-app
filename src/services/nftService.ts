/**
 * NFT Service - Functions for fetching user NFTs from NFT Navigator API
 */

export interface NFTToken {
  owner: string;
  creator: string;
  tokenId: string;
  approved: string;
  isBurned: boolean;
  metadata: string;
  verified: number;
  contractId: number;
  "mint-round": number;
  blacklisted: boolean;
  lastUpdated: string;
  metadataURI: string;
  collectionName: string;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  image_integrity?: string;
  image_mimetype?: string;
  properties?: Record<string, string>;
  royalties?: string;
}

export interface NFTIndexerResponse {
  tokens: NFTToken[];
  "next-token": string | null;
  "total-count": number;
  "current-round": number;
}

// NFT contract IDs and their multipliers (from config)
const NFT_CONTRACT_MULTIPLIERS: Record<number, number> = {
  313597: 0.10, // Dorks V1
  894888: 0.01, // Dorks V2
  313705: 0.15, // Lil Chubs
};

const NFT_INDEXER_BASE_URL = "https://voi-mainnet-mimirapi.nftnavigator.xyz/nft-indexer/v1";

/**
 * Fetches NFTs for a given owner address from the NFT Navigator API
 * @param ownerAddress The wallet address to fetch NFTs for
 * @param contractIds Array of contract IDs to filter by (optional)
 * @param limit Maximum number of tokens to fetch (default: 600)
 * @returns Promise<NFTIndexerResponse> The NFT data from the API
 */
export const fetchUserNFTs = async (
  ownerAddress: string,
  contractIds?: number[],
  limit: number = 600
): Promise<NFTIndexerResponse> => {
  const contractIdParam = contractIds && contractIds.length > 0 
    ? contractIds.join(",") 
    : undefined;

  const params = new URLSearchParams({
    owner: ownerAddress,
    limit: limit.toString(),
  });

  if (contractIdParam) {
    params.append("contractId", contractIdParam);
  }

  const url = `${NFT_INDEXER_BASE_URL}/tokens?${params.toString()}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch NFTs: ${response.statusText}`);
    }

    const data: NFTIndexerResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching user NFTs:", error);
    throw error;
  }
};

/**
 * Parses NFT metadata from JSON string
 * @param metadataString JSON string containing NFT metadata
 * @returns NFTMetadata parsed metadata object
 */
export const parseNFTMetadata = (metadataString: string): NFTMetadata => {
  try {
    return JSON.parse(metadataString);
  } catch (error) {
    console.error("Error parsing NFT metadata:", error);
    return {
      name: "Unknown",
      description: "",
      image: "",
    };
  }
};

/**
 * Gets the multiplier for a given NFT contract ID
 * @param contractId The contract ID of the NFT
 * @returns The multiplier value (0 if not a governance NFT)
 */
export const getNFTMultiplier = (contractId: number): number => {
  return NFT_CONTRACT_MULTIPLIERS[contractId] || 0;
};

/**
 * Filters NFTs to only include governance NFTs (those with multipliers)
 * @param tokens Array of NFT tokens
 * @returns Array of governance NFTs with multipliers
 */
export const filterGovernanceNFTs = (tokens: NFTToken[]): Array<NFTToken & { multiplier: number }> => {
  return tokens
    .filter((token) => !token.isBurned && getNFTMultiplier(token.contractId) > 0)
    .map((token) => ({
      ...token,
      multiplier: getNFTMultiplier(token.contractId),
    }));
};
