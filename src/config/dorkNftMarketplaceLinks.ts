import type { DorkNftCollectionId } from "@/data/dorkNftAlgorandRegistry";
import type { NetworkId } from "@/config";

export interface DorkNftMarketplaceLink {
  id: DorkNftCollectionId;
  label: string;
  url: string;
  imageUrl: string;
}

export const VOI_NAUTILUS_MARKETPLACE_ORIGIN = "https://app.nautilus.sh";

const COLLECTION_MARKETPLACE_ENTRIES = [
  {
    id: "dorks_v1" as const,
    label: "Dorks",
    imageUrl:
      "https://ipfs.algonode.xyz/ipfs/bafkreiaefdqglsg35ziv6hxud6n2zplimujns2mt553mqzxj2hyvkzophi?optimizer=image&width=400",
    algorandUrl: "https://www.downbad.farm/collection/dorks",
    voiContractId: 313597,
  },
  {
    id: "lil_chubs" as const,
    label: "Chubs",
    imageUrl:
      "https://ipfs.algonode.xyz/ipfs/bafybeibyq4imsplnfqpvrdkavjmupjwzzz3thhf35ea3evr2tbtdfbd53a?optimizer=image&width=400",
    algorandUrl: "https://www.downbad.farm/collection/chub",
    voiContractId: 313705,
  },
  {
    id: "dorks_v2" as const,
    label: "Dorks V2",
    imageUrl:
      "https://ipfs.algonode.xyz/ipfs/bafybeibl4szt2eayrfnzwqcgbod4wiookybnyjc3ud7xylmqds6ba7jqqe?optimizer=image&width=400",
    algorandUrl: "https://www.downbad.farm/collection/dorks-v2",
    voiContractId: 894888,
  },
] as const;

function buildMarketplaceLinks(
  resolveUrl: (entry: (typeof COLLECTION_MARKETPLACE_ENTRIES)[number]) => string
): DorkNftMarketplaceLink[] {
  return COLLECTION_MARKETPLACE_ENTRIES.map((entry) => ({
    id: entry.id,
    label: entry.label,
    imageUrl: entry.imageUrl,
    url: resolveUrl(entry),
  }));
}

export function getVoiNautilusCollectionTradeUrl(contractId: number): string {
  return `${VOI_NAUTILUS_MARKETPLACE_ORIGIN}/#/collection/${contractId}/trade`;
}

export function getDorkNftMarketplaceLinks(
  networkId: NetworkId
): DorkNftMarketplaceLink[] {
  if (networkId === "algorand-mainnet") {
    return buildMarketplaceLinks((entry) => entry.algorandUrl);
  }

  return buildMarketplaceLinks((entry) =>
    getVoiNautilusCollectionTradeUrl(entry.voiContractId)
  );
}
