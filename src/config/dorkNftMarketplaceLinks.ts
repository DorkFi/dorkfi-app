import type { DorkNftCollectionId } from "@/data/dorkNftAlgorandRegistry";
import type { NetworkId } from "@/config";

export interface DorkNftMarketplaceLink {
  id: DorkNftCollectionId;
  label: string;
  url: string;
}

export const VOI_NAUTILUS_MARKETPLACE_ORIGIN = "https://app.nautilus.sh";

const ALGORAND_MAINNET_LINKS: DorkNftMarketplaceLink[] = [
  {
    id: "dorks_v1",
    label: "Dorks",
    url: "https://www.downbad.farm/collection/dorks",
  },
  {
    id: "dorks_v2",
    label: "Dorks V2",
    url: "https://www.downbad.farm/collection/dorks-v2",
  },
  {
    id: "lil_chubs",
    label: "Chubs",
    url: "https://www.downbad.farm/collection/chub",
  },
];

const VOI_MAINNET_LINKS: DorkNftMarketplaceLink[] = [
  {
    id: "dorks_v1",
    label: "Dorks",
    url: `${VOI_NAUTILUS_MARKETPLACE_ORIGIN}/#/collection/313597/trade`,
  },
  {
    id: "dorks_v2",
    label: "Dorks V2",
    url: `${VOI_NAUTILUS_MARKETPLACE_ORIGIN}/#/collection/894888/trade`,
  },
  {
    id: "lil_chubs",
    label: "Chubs",
    url: `${VOI_NAUTILUS_MARKETPLACE_ORIGIN}/#/collection/313705/trade`,
  },
];

export function getVoiNautilusCollectionTradeUrl(contractId: number): string {
  return `${VOI_NAUTILUS_MARKETPLACE_ORIGIN}/#/collection/${contractId}/trade`;
}

export function getDorkNftMarketplaceLinks(
  networkId: NetworkId
): DorkNftMarketplaceLink[] {
  if (networkId === "algorand-mainnet") {
    return ALGORAND_MAINNET_LINKS;
  }

  return VOI_MAINNET_LINKS;
}
