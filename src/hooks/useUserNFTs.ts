import { useState, useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  fetchUserNFTs,
  filterGovernanceNFTs,
  parseNFTMetadata,
  NFTToken,
} from "@/services/nftService";
import { GovernanceNFT } from "@/components/governance/NFTMultiplierDropdown";

// Governance NFT contract IDs
const GOVERNANCE_NFT_CONTRACTS = [313597, 894888, 313705];

/**
 * Hook to fetch and manage user's governance NFTs
 * @returns Object containing user NFTs, loading state, and error
 */
export const useUserNFTs = () => {
  const { activeAccount } = useWallet();
  const [userNFTs, setUserNFTs] = useState<GovernanceNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNFTs = async () => {
      if (!activeAccount?.address) {
        setUserNFTs([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetchUserNFTs(
          activeAccount.address,
          GOVERNANCE_NFT_CONTRACTS,
          600
        );

        // Filter to only governance NFTs and convert to GovernanceNFT format
        const governanceNFTs = filterGovernanceNFTs(response.tokens);
        
        const formattedNFTs: GovernanceNFT[] = governanceNFTs.map((token) => {
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
            id: `${token.contractId}-${token.tokenId}`,
            name: metadata.name || collectionName,
            multiplier: token.multiplier,
            image: metadata.image || "",
          };
        });

        setUserNFTs(formattedNFTs);
      } catch (err: any) {
        console.error("Failed to fetch user NFTs:", err);
        setError(err?.message || "Failed to load NFTs");
        setUserNFTs([]);
      } finally {
        setLoading(false);
      }
    };

    loadNFTs();
  }, [activeAccount?.address]);

  return {
    userNFTs,
    loading,
    error,
  };
};
