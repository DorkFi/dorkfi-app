/**
 * Algorand Dork NFT service.
 *
 * Discovers bridged Dork NFTs (ARC-69 ASAs) held by an Algorand account and resolves
 * profile-picture avatar values without requiring Voi or an enVoi (.voi) name. Uses the
 * shared registry so images/names come from a deterministic CDN scheme.
 */

import algorandService from "@/services/algorandService";
import { getAlgorandNetworkFromNetworkId, type NetworkId } from "@/config";
import {
  DORK_NFT_ASSET_IDS,
  getDorkNftByAssetId,
  getDorkNftByVoi,
  type DorkNftEntry,
} from "@/data/dorkNftAlgorandRegistry";

const COLLECTION_ORDER: Record<string, number> = {
  dorks_v1: 0,
  dorks_v2: 1,
  lil_chubs: 2,
};

/** Read the numeric asset id from an indexer holding across algosdk field-name variants. */
function readAssetId(holding: unknown): number | null {
  if (holding == null || typeof holding !== "object") return null;
  const h = holding as Record<string, unknown>;
  const raw = h.assetId ?? h["asset-id"];
  if (raw == null) return null;
  try {
    return Number(raw);
  } catch {
    return null;
  }
}

/** Read the held amount from an indexer holding across algosdk field-name variants. */
function readAmount(holding: unknown): bigint {
  if (holding == null || typeof holding !== "object") return 0n;
  const h = holding as Record<string, unknown>;
  const raw = h.amount;
  if (raw == null) return 0n;
  try {
    return BigInt(String(raw));
  } catch {
    return 0n;
  }
}

/**
 * Fetch the bridged Dork NFTs currently held (amount > 0) by an Algorand account.
 * Paginates the account's asset holdings and filters against the registry.
 */
export async function fetchOwnedDorkNftsOnAlgorand(
  networkId: NetworkId,
  address: string
): Promise<DorkNftEntry[]> {
  const algoNet = getAlgorandNetworkFromNetworkId(networkId);
  if (!algoNet || !address) return [];

  const { indexer } = await algorandService.initializeClientsForReads(algoNet);

  const owned: DorkNftEntry[] = [];
  let nextToken: string | undefined;

  do {
    let query = indexer.lookupAccountAssets(address).limit(1000);
    if (nextToken) query = query.nextToken(nextToken);
    const res = (await query.do()) as unknown as {
      assets?: unknown[];
      nextToken?: string;
      ["next-token"]?: string;
    };

    const holdings = res.assets ?? [];
    for (const holding of holdings) {
      const assetId = readAssetId(holding);
      if (assetId == null || !DORK_NFT_ASSET_IDS.has(assetId)) continue;
      if (readAmount(holding) <= 0n) continue;
      const entry = getDorkNftByAssetId(assetId);
      if (entry) owned.push(entry);
    }

    nextToken = res.nextToken ?? res["next-token"];
  } while (nextToken);

  owned.sort((a, b) => {
    const collDiff =
      (COLLECTION_ORDER[a.collectionId] ?? 99) -
      (COLLECTION_ORDER[b.collectionId] ?? 99);
    return collDiff !== 0 ? collDiff : a.voiTokenId - b.voiTokenId;
  });

  return owned;
}

/**
 * Resolve a stored avatar value to a Dork registry entry.
 * Accepts the canonical `arc72:<contract>:<token>` form or the Algorand-specific `asa:<assetId>`.
 */
export function resolveDorkAvatarEntry(
  avatarValue: string | null | undefined
): DorkNftEntry | undefined {
  if (!avatarValue) return undefined;
  const value = avatarValue.trim();

  const arc72 = value.match(/^arc72:(\d+):(\d+)$/);
  if (arc72) {
    return getDorkNftByVoi(Number(arc72[1]), Number(arc72[2]));
  }

  const asa = value.match(/^asa:(\d+)$/);
  if (asa) {
    return getDorkNftByAssetId(Number(asa[1]));
  }

  return undefined;
}

/** Resolve a stored avatar value directly to a displayable image URL, if it is a known Dork NFT. */
export const resolveDorkAvatarImageUrl = (
  avatarValue: string | null | undefined
): string | null => resolveDorkAvatarEntry(avatarValue)?.imageUrl ?? null;
