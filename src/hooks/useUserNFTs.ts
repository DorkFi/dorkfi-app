import { useState, useEffect, useCallback } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';
import { isAlgorandCompatibleNetwork } from '@/config';

export interface UserNFT {
  assetId: number;
  tokenId: string;
  name: string;
  imageUrl: string | null;
  contractId: number;
  collectionName: string | null;
  metadata: any;
}

export interface UserNFTsData {
  nfts: UserNFT[];
  isLoading: boolean;
  error: string | null;
}

const NFT_INDEXER_BASE_URL = 'https://voi-mainnet-mimirapi.nftnavigator.xyz/nft-indexer/v1';
// Supported contract IDs for NFT collections
const CONTRACT_IDS = [313597, 313705, 894888];

export const useUserNFTs = (userAddress: string | null) => {
  const { currentNetwork } = useNetwork();
  const [data, setData] = useState<UserNFTsData>({
    nfts: [],
    isLoading: false,
    error: null,
  });

  const fetchUserNFTs = useCallback(async () => {
    if (!userAddress || !currentNetwork) {
      setData({
        nfts: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    if (!isAlgorandCompatibleNetwork(currentNetwork)) {
      setData({
        nfts: [],
        isLoading: false,
        error: 'NFT fetching is only supported on Algorand networks',
      });
      return;
    }

    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('Fetching user NFTs for:', userAddress, 'on network:', currentNetwork);
      
      // Fetch NFTs from all contract IDs in parallel
      const fetchPromises = CONTRACT_IDS.map(async (contractId) => {
        try {
          const url = `${NFT_INDEXER_BASE_URL}/tokens?contractId=${contractId}&owner=${userAddress}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            console.warn(`Failed to fetch NFTs for contract ${contractId}: ${response.status} ${response.statusText}`);
            return [];
          }
          
          const data = await response.json();
          return data.tokens || [];
        } catch (error) {
          console.error(`Error fetching NFTs for contract ${contractId}:`, error);
          return [];
        }
      });
      
      // Wait for all requests to complete
      const results = await Promise.all(fetchPromises);
      
      // Aggregate all tokens from all contract IDs
      const allTokens = results.flat();
      const nfts: UserNFT[] = [];
      
      for (const token of allTokens) {
        // Skip burned tokens
        if (token.isBurned) {
          continue;
        }
        
        try {
          // Parse metadata JSON string
          let metadata = {};
          let imageUrl: string | null = null;
          let name = `Token ${token.tokenId}`;
          
          if (token.metadata) {
            try {
              metadata = typeof token.metadata === 'string' 
                ? JSON.parse(token.metadata) 
                : token.metadata;
              
              // Extract name and image from metadata
              if (metadata.name) {
                name = metadata.name;
              }
              if (metadata.image) {
                imageUrl = metadata.image;
              }
            } catch (parseError) {
              console.error('Error parsing metadata for token', token.tokenId, parseError);
            }
          }
          
          nfts.push({
            assetId: token.contractId, // Using contractId as assetId
            tokenId: token.tokenId,
            name,
            imageUrl,
            contractId: token.contractId,
            collectionName: token.collectionName || null,
            metadata,
          });
        } catch (error) {
          console.error(`Error processing token ${token.tokenId}:`, error);
          // Continue with other tokens
        }
      }

      setData({
        nfts,
        isLoading: false,
        error: null,
      });

      console.log('User NFTs fetched:', nfts);
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user NFTs',
      }));
    }
  }, [userAddress, currentNetwork]);

  useEffect(() => {
    fetchUserNFTs();
  }, [fetchUserNFTs]);

  return {
    ...data,
    refetch: fetchUserNFTs,
  };
};

