import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  fetchUserNFTs,
  parseNFTMetadata,
  getNFTMultiplier,
} from "@/services/nftService";
import { GovernanceNFT } from "@/components/governance/NFTMultiplierDropdown";
import { useNetwork } from "@/contexts/NetworkContext";
import { getContractAddress, GovernanceConfig } from "@/config";
import { fetchOwnedDorkNftsOnAlgorand } from "@/services/algorandNftService";

// Fallback governance NFT contract IDs when config has no powerMultipliers
const FALLBACK_GOVERNANCE_NFT_CONTRACTS = [313597, 894888, 313705];

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
  const { currentNetwork } = useNetwork();
  const [nfts, setNfts] = useState<UserNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetAddress = address || activeAccount?.address;

  // Use powerMultipliers from config so NFT multipliers stay in sync with config updates
  const { contractIds, bonusByContractId, labelByContractId } = useMemo(() => {
    const governanceConfig = getContractAddress(
      currentNetwork,
      "governance"
    ) as GovernanceConfig | string | undefined;

    const powerMultipliers =
      governanceConfig && typeof governanceConfig === "object"
        ? governanceConfig.powerMultipliers ?? []
        : [];

    if (powerMultipliers.length > 0) {
      return {
        contractIds: powerMultipliers.map((p) => p.contractId),
        bonusByContractId: new Map(
          powerMultipliers.map((p) => [p.contractId, p.bonus])
        ),
        labelByContractId: new Map(
          powerMultipliers.map((p) => [p.contractId, p.label])
        ),
      };
    }

    return {
      contractIds: FALLBACK_GOVERNANCE_NFT_CONTRACTS,
      bonusByContractId: null as Map<number, number> | null,
      labelByContractId: null as Map<number, string> | null,
    };
  }, [currentNetwork]);

  const loadNFTs = useCallback(async () => {
    if (!targetAddress) {
      setNfts([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // On Algorand, Dork NFTs are bridged ARC-69 ASAs (not Voi ARC-72), so discover them from
      // the account's asset holdings via the registry rather than the Voi NFT indexer.
      if (currentNetwork === "algorand-mainnet") {
        const owned = await fetchOwnedDorkNftsOnAlgorand(
          currentNetwork,
          targetAddress
        );
        const formattedNFTs: UserNFT[] = owned.map((entry) => ({
          contractId: entry.voiContractId,
          tokenId: String(entry.voiTokenId),
          name: entry.name,
          imageUrl: entry.imageUrl,
          collectionName: entry.collectionName,
        }));
        setNfts(formattedNFTs);
        return;
      }

      const response = await fetchUserNFTs(
        targetAddress,
        contractIds,
        600
      );

      const getMultiplier = (cid: number) =>
        bonusByContractId?.get(cid) ?? getNFTMultiplier(cid);

      const governanceTokens = response.tokens.filter(
        (t) => !t.isBurned && getMultiplier(t.contractId) > 0
      );

      const formattedNFTs: UserNFT[] = governanceTokens.map((token) => {
        const metadata = parseNFTMetadata(token.metadata);
        const collectionName =
          labelByContractId?.get(token.contractId) ??
          token.collectionName ??
          "Unknown";

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
  }, [
    targetAddress,
    contractIds,
    bonusByContractId,
    labelByContractId,
    currentNetwork,
  ]);

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
    multiplier:
      bonusByContractId?.get(nft.contractId) ?? getNFTMultiplier(nft.contractId),
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
