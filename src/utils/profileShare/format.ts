import { DEFAULT_REPAY_SHARE_LINK } from "@/utils/repayShare/format";
import type { ProfileShareCollection } from "./types";

/** Voi ARC-72 contract ids used across Voi + bridged Algorand avatars. */
export const PROFILE_NFT_CONTRACTS = {
  dorks_v1: 313597,
  lil_chubs: 313705,
  dorks_v2: 894888,
} as const;

export const UNIT_PER_WEEK_BY_COLLECTION: Record<
  Exclude<ProfileShareCollection, "unknown">,
  number | null
> = {
  dorks_v1: 4,
  dorks_v2: 0.8,
  lil_chubs: null,
};

export function resolveProfileShareCollection(input: {
  contractId?: number;
  collectionId?: ProfileShareCollection;
  nftName?: string;
}): ProfileShareCollection {
  if (
    input.collectionId &&
    input.collectionId !== "unknown" &&
    input.collectionId in UNIT_PER_WEEK_BY_COLLECTION
  ) {
    return input.collectionId;
  }

  if (input.contractId === PROFILE_NFT_CONTRACTS.dorks_v1) return "dorks_v1";
  if (input.contractId === PROFILE_NFT_CONTRACTS.dorks_v2) return "dorks_v2";
  if (input.contractId === PROFILE_NFT_CONTRACTS.lil_chubs) return "lil_chubs";

  const name = (input.nftName || "").trim().toUpperCase();
  if (name.startsWith("DORKS")) return "dorks_v2";
  if (name.startsWith("DORK")) return "dorks_v1";
  if (name.startsWith("CHUB")) return "lil_chubs";

  return "unknown";
}

export function formatProfileNftItemName(nftName: string): string {
  return nftName.trim() || "my NFT";
}

export type ProfileShareTweetTextInput = {
  nftName: string;
  contractId?: number;
  collectionId?: ProfileShareCollection;
  shareUrl?: string;
};

/**
 * Builds X compose text for a profile-picture share.
 * DORK → 4 $UNIT/week · DORKV2 → 0.8 $UNIT/week · CHUB → no earnings line.
 */
export function buildProfileShareTweetText(
  input: ProfileShareTweetTextInput
): string {
  const item = formatProfileNftItemName(input.nftName);
  const collection = resolveProfileShareCollection(input);
  const link = input.shareUrl?.trim() || DEFAULT_REPAY_SHARE_LINK;

  let body: string;
  if (collection === "lil_chubs") {
    body = `I just set a new profile picture on DorkFi!\n\n${item} may not earn $UNIT each week, but it looks great and adds to my voting power.`;
  } else if (collection === "dorks_v1" || collection === "dorks_v2") {
    const amount = UNIT_PER_WEEK_BY_COLLECTION[collection];
    body = `I just set a new profile picture on DorkFi!\n\n${item} earns me ${amount} $UNIT each week and adds to my voting power.`;
  } else {
    body = `I just set a new profile picture on DorkFi!\n\n${item} adds to my voting power.`;
  }

  return [body, "", "@dork_fi #DorkFi", "", link].join("\n");
}
