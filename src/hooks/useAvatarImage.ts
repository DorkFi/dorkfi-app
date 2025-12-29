import { useState, useEffect, useRef } from "react";
import { useAddressName } from "./useAddressName";
import { ResolverService } from "@/services/resolverService";
import { useNetwork } from "@/contexts/NetworkContext";
import { useWallet } from "@txnlab/use-wallet-react";

const NFT_INDEXER_BASE_URL = "https://voi-mainnet-mimirapi.nftnavigator.xyz/nft-indexer/v1";
const PLACEHOLDER_IMAGE = "/lovable-uploads/dork_health_placeholder_v2.png";
// Supported contract IDs for NFT collections
const SUPPORTED_CONTRACT_IDS = [313597, 313705, 894888];

interface NFTTokenResponse {
  tokens: Array<{
    tokenId: string;
    contractId: number;
    metadata?: string | any;
    image?: string;
    [key: string]: any;
  }>;
}

/**
 * Hook to resolve and fetch the avatar image from avatar_dorkfi text record
 * @param address - The wallet address to resolve avatar for
 * @returns The avatar image URL or placeholder
 */
export const useAvatarImage = (address: string | undefined | null) => {
  const { name: addressName, isLoading: isLoadingName } = useAddressName(address);
  const { currentNetwork } = useNetwork();
  const { activeWallet } = useWallet();
  // Start with null - don't render until we check if custom avatar exists
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Track when avatar check is complete (whether avatar found or not)
  const [isResolved, setIsResolved] = useState<boolean>(false);
  // Use ref to track if we've already fetched to prevent duplicate fetches
  const fetchedRef = useRef<string | null>(null);
  // Track if we've already updated state - prevents multiple updates
  const hasUpdatedRef = useRef<boolean>(false);
  // Track if we're actively loading a custom avatar - prevents placeholder from being set
  const isLoadingCustomAvatarRef = useRef<boolean>(false);
  // Refresh key to trigger refetch
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Reset state when address or network changes
    setAvatarImage(null);
    setIsResolved(false);
    hasUpdatedRef.current = false;
    isLoadingCustomAvatarRef.current = false;
    fetchedRef.current = null;

    // Wait for address name to finish loading before attempting to fetch avatar
    if (isLoadingName) {
      return;
    }

    // Check if wallet is a universal wallet (Lute, Kibisis, etc.) that supports both networks
    const walletId = activeWallet?.id?.toLowerCase() || "";
    const isUniversalWallet = walletId === "lute" || walletId === "kibisis";

    // Fetch avatar on voi-mainnet OR if using a universal wallet (regardless of network)
    const shouldFetchAvatar = currentNetwork === "voi-mainnet" || isUniversalWallet;

    if (!address || !addressName || !shouldFetchAvatar) {
      // Not on voi-mainnet (and not using universal wallet) or missing requirements, mark as resolved (no avatar)
      setIsLoading(false);
      setIsResolved(true);
      return;
    }

    // Create a unique key for this fetch to prevent duplicate fetches
    const fetchKey = `${address}-${addressName}`;
    if (fetchedRef.current === fetchKey) {
      // Already fetched for this address/name combination
      return;
    }

    // Don't reset flag here - we want to prevent placeholder from being set
    // if we're actively fetching a custom avatar

    const fetchAvatarImage = async () => {
      // Mark that we're fetching for this address/name
      fetchedRef.current = fetchKey;
      setIsLoading(true);
      setError(null);
      // Reset flag only when we start fetching - this prevents placeholder
      // from being set while we're checking for custom avatar
      hasUpdatedRef.current = false;

      try {
        // Initialize resolver service for mainnet
        const resolver = new ResolverService("mainnet", address);

        // Get avatar_dorkfi text record
        const avatarValue = await resolver.text(addressName, "avatar_dorkfi");

        if (!avatarValue || !avatarValue.trim()) {
          // No avatar_dorkfi set, mark as resolved (no avatar)
          setIsLoading(false);
          setIsResolved(true);
          return;
        }

        // Parse arc72 format: arc72:<contractId>:<tokenId>
        const arc72Match = avatarValue.trim().match(/^arc72:(\d+):(\d+)$/);
        
        if (!arc72Match) {
          // Invalid format, mark as resolved (no avatar)
          console.warn("Invalid avatar_dorkfi format:", avatarValue);
          setIsLoading(false);
          setIsResolved(true);
          return;
        }

        const [, contractId, tokenId] = arc72Match;

        // Fetch all tokens from supported contract IDs in a single request
        const contractIdsParam = SUPPORTED_CONTRACT_IDS.join(",");
        const indexerUrl = `${NFT_INDEXER_BASE_URL}/tokens?contractId=${contractIdsParam}&owner=${address}`;
        
        const response = await fetch(indexerUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch NFT: ${response.statusText}`);
        }

        const data: NFTTokenResponse = await response.json();

        // Check if we got any tokens
        if (!data.tokens || data.tokens.length === 0) {
          // No tokens found, mark as resolved (no avatar)
          setIsLoading(false);
          setIsResolved(true);
          return;
        }

        // Find the specific token matching contractId and tokenId
        const token = data.tokens.find(
          (t) => 
            String(t.contractId) === String(contractId) && 
            String(t.tokenId) === String(tokenId)
        );

        if (!token) {
          // Token not found in user's collection, mark as resolved (no avatar)
          setIsLoading(false);
          setIsResolved(true);
          return;
        }

        // Extract image from metadata
        let imageUrl: string | null = null;

        if (token.metadata) {
          try {
            const metadata = typeof token.metadata === "string" 
              ? JSON.parse(token.metadata) 
              : token.metadata;
            
            if (metadata.image) {
              imageUrl = metadata.image;
            }
          } catch (parseError) {
            console.error("Error parsing token metadata:", parseError);
          }
        }

        // Use token.image if available (some APIs return it directly)
        if (!imageUrl && token.image) {
          imageUrl = token.image;
        }

        // If we have an image URL, preload it before updating state
        if (imageUrl) {
          // Mark that we're loading a custom avatar - this prevents placeholder from being set
          isLoadingCustomAvatarRef.current = true;
          
          // Handle IPFS URLs
          if (imageUrl.startsWith("ipfs://")) {
            imageUrl = `https://ipfs.io/ipfs/${imageUrl.replace("ipfs://", "")}`;
          }
          
          // Preload image to ensure it's ready before updating state
          const img = new Image();
          img.onload = () => {
            // Delay to ensure image is fully decoded and ready
            // This prevents any visual transitions when the component renders
            setTimeout(() => {
              // Only update state once - check if we've already updated
              if (!hasUpdatedRef.current) {
                hasUpdatedRef.current = true;
                isLoadingCustomAvatarRef.current = false;
                setAvatarImage(imageUrl);
                setIsResolved(true);
              }
            }, 200); 
          };
          img.onerror = () => {
            // If image fails to load, mark as resolved (no avatar)
            console.error("Failed to load avatar image:", imageUrl);
            isLoadingCustomAvatarRef.current = false;
            setIsResolved(true);
          };
          img.src = imageUrl;
        } else {
          // If no imageUrl, mark as resolved (no avatar)
          isLoadingCustomAvatarRef.current = false;
          setIsResolved(true);
        }
      } catch (err) {
        console.error("Error fetching avatar image:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
        // On error, mark as resolved (no avatar)
        isLoadingCustomAvatarRef.current = false;
        setIsResolved(true);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately when component mounts (before tab transition)
    // This preloads the image so it's ready when the tab becomes visible
    fetchAvatarImage();
  }, [address, addressName, currentNetwork, isLoadingName, refreshKey, activeWallet]);

  const refetch = () => {
    setRefreshKey(prev => prev + 1);
  };

  return { avatarImage, isLoading, error, isResolved, refetch };
};

