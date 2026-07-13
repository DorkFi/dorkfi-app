import type { DorkNftCollectionId } from "@/data/dorkNftAlgorandRegistry";
import type { NetworkId } from "@/config";

export interface DorkNftMarketplaceLink {
  id: DorkNftCollectionId;
  label: string;
  url: string;
  imageUrl: string;
}

export const VOI_NAUTILUS_MARKETPLACE_ORIGIN = "https://app.nautilus.sh";

/** Local static previews — avoid third-party IPFS gateways (e.g. algonode) that fail on some networks. */
const COLLECTION_MARKETPLACE_ENTRIES = [
  {
    id: "dorks_v1" as const,
    label: "Dorks",
    imageUrl: "/lovable-uploads/dorks-collection-preview.png",
    algorandUrl: "https://www.downbad.farm/collection/dorks",
    voiContractId: 313597,
  },
  {
    id: "lil_chubs" as const,
    label: "Chubs",
    imageUrl: "/lovable-uploads/chubs-collection-preview.png",
    algorandUrl: "https://www.downbad.farm/collection/chub",
    voiContractId: 313705,
  },
  {
    id: "dorks_v2" as const,
    label: "Dorks V2",
    imageUrl: "/lovable-uploads/dorks-v2-collection-preview.png",
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
