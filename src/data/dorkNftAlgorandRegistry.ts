import registryData from "@/data/dorkNftAlgorandRegistry.json";

/**
 * Registry of Dork NFTs bridged from Voi (ARC-72) to Algorand (ARC-69 ASAs).
 *
 * Source of truth is the generated `dorkNftAlgorandRegistry.json` (from the bridge export),
 * which stores only `[assetId, voiContractId, voiTokenId]`. Display name and image URL are
 * derived, since both follow a deterministic scheme per collection on the HighForge CDN.
 */

export type DorkNftCollectionId = "dorks_v1" | "dorks_v2" | "lil_chubs";

export interface DorkNftEntry {
  /** Algorand Standard Asset id of the bridged NFT. */
  assetId: number;
  /** Original Voi ARC-72 contract (application) id. */
  voiContractId: number;
  /** Original Voi ARC-72 token id (1-indexed within the collection). */
  voiTokenId: number;
  collectionId: DorkNftCollectionId;
  collectionName: string;
  name: string;
  imageUrl: string;
}

interface CollectionMeta {
  id: DorkNftCollectionId;
  name: string;
  /** Prefix used for the per-token display name, e.g. `DORK 12`. */
  namePrefix: string;
  /** File extension used by the HighForge CDN render for this collection. */
  ext: "png" | "webp";
}

const COLLECTION_BY_CONTRACT: Record<number, CollectionMeta> = {
  313597: { id: "dorks_v1", name: "Dorks v1", namePrefix: "DORK", ext: "webp" },
  313705: { id: "lil_chubs", name: "Lil Chubs", namePrefix: "CHUB", ext: "webp" },
  894888: { id: "dorks_v2", name: "Dorks v2", namePrefix: "DORKS", ext: "png" },
};

const HIGHFORGE_CDN = "https://prod.cdn.highforge.io/m";

/** Shared reserve address for every bridged Dork ASA (used for wallet discovery). */
export const DORK_NFT_RESERVE_ADDRESS = registryData.reserve as string;

/** Canonical, chain-agnostic key for a Dork NFT: matches the `arc72:<contract>:<token>` avatar format. */
export const canonicalDorkKey = (contractId: number, tokenId: number): string =>
  `${contractId}:${tokenId}`;

function buildEntry(
  assetId: number,
  contractId: number,
  tokenId: number
): DorkNftEntry | null {
  const meta = COLLECTION_BY_CONTRACT[contractId];
  if (!meta) return null;
  return {
    assetId,
    voiContractId: contractId,
    voiTokenId: tokenId,
    collectionId: meta.id,
    collectionName: meta.name,
    name: `${meta.namePrefix} ${tokenId}`,
    imageUrl: `${HIGHFORGE_CDN}/${contractId}/${tokenId}.${meta.ext}`,
  };
}

const byAssetId = new Map<number, DorkNftEntry>();
const byCanonical = new Map<string, DorkNftEntry>();

for (const [assetId, contractId, tokenId] of registryData.tuples as Array<
  [number, number, number]
>) {
  const entry = buildEntry(assetId, contractId, tokenId);
  if (!entry) continue;
  byAssetId.set(assetId, entry);
  byCanonical.set(canonicalDorkKey(contractId, tokenId), entry);
}

/** All bridged Dork ASA ids, for fast membership checks during wallet discovery. */
export const DORK_NFT_ASSET_IDS: ReadonlySet<number> = new Set(byAssetId.keys());

export const isDorkNftAssetId = (assetId: number): boolean =>
  byAssetId.has(assetId);

export const getDorkNftByAssetId = (
  assetId: number
): DorkNftEntry | undefined => byAssetId.get(assetId);

export const getDorkNftByVoi = (
  contractId: number,
  tokenId: number
): DorkNftEntry | undefined =>
  byCanonical.get(canonicalDorkKey(contractId, tokenId));

/** Total number of registered bridged Dork NFTs. */
export const DORK_NFT_REGISTRY_SIZE = byAssetId.size;
