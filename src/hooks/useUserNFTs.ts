import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  fetchUserNFTs,
  filterGovernanceNFTs,
  parseNFTMetadata,
  getNFTMultiplier,
  NFTToken,
} from "@/services/nftService";
import { GovernanceNFT } from "@/components/governance/NFTMultiplierDropdown";

// Governance NFT contract IDs
const GOVERNANCE_NFT_CONTRACTS = [313597, 894888, 313705];

/**
 * UserNFT type for NFT selection modal and profile customization
 */
export interface UserNFT {
  contractId: number;
  tokenId: string;
  name: string;
  imageUrl: string;
  collectionName?: string;
}

/**
 * Hook to fetch and manage user's governance NFTs
 * @param address Optional address to fetch NFTs for (defaults to activeAccount address)
 * @returns Object containing user NFTs, loading state, error, and refetch function
 */
export const useUserNFTs = (address?: string | null) => {
  const { activeAccount } = useWallet();
  const [nfts, setNfts] = useState<UserNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetAddress = address || activeAccount?.address;

  const loadNFTs = useCallback(async () => {
    if (!targetAddress) {
      setNfts([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchUserNFTs(
        targetAddress,
        GOVERNANCE_NFT_CONTRACTS,
        600
      );

      // Filter to only governance NFTs and convert to UserNFT format
      const governanceNFTs = filterGovernanceNFTs(response.tokens);
      
      const formattedNFTs: UserNFT[] = governanceNFTs.map((token) => {
        const metadata = parseNFTMetadata(token.metadata);
        
        // Determine collection name for display
        let collectionName = token.collectionName || "Unknown";
        if (token.contractId === 313597) {
          collectionName = "Dorks V1";
        } else if (token.contractId === 894888) {
          collectionName = "Dorks V2";
        } else if (token.contractId === 313705) {
          collectionName = "Lil Chubs";
        }

        return {
          contractId: token.contractId,
          tokenId: token.tokenId,
          name: metadata.name || collectionName,
          imageUrl: metadata.image || "",
          collectionName,
        };
      });

      setNfts(formattedNFTs);
    } catch (err: any) {
      console.error("Failed to fetch user NFTs:", err);
      setError(err?.message || "Failed to load NFTs");
      setNfts([]);
    } finally {
      setIsLoading(false);
    }
  }, [targetAddress]);

  useEffect(() => {
    loadNFTs();
  }, [loadNFTs]);

  const refetch = useCallback(() => {
    return loadNFTs();
  }, [loadNFTs]);

  // Also return userNFTs for backward compatibility with governance components
  const userNFTs: GovernanceNFT[] = nfts.map((nft) => ({
    id: `${nft.contractId}-${nft.tokenId}`,
    name: nft.name,
    multiplier: getNFTMultiplier(nft.contractId),
    image: nft.imageUrl,
  }));

  return {
    nfts,
    userNFTs, // For backward compatibility
    isLoading,
    loading: isLoading, // For backward compatibility
    error,
    refetch,
  };
};
