/**
 * Algorand profile avatar storage.
 *
 * Persists a user's chosen Dork NFT profile picture on Algorand without an enVoi (.voi) name.
 * The DorkFi API is the durable, cross-device store; a localStorage cache mirrors the choice so
 * the UI reflects it instantly (and still works if the API has not yet propagated the change).
 */

import dorkfiAPIService from "@/services/dorkfiAPIService";

const STORAGE_PREFIX = "dorkfi:algorand-avatar:";

export interface AlgorandAvatarSelection {
  /** Displayable image URL (the durable field). */
  imageUrl: string;
  /** Canonical avatar value, e.g. `arc72:313597:1`. Optional (not returned by the read endpoint). */
  avatarValue?: string;
}

const storageKey = (address: string): string =>
  `${STORAGE_PREFIX}${address.toUpperCase()}`;

/** Read the locally cached avatar selection for an address, if any. */
export function getCachedAlgorandAvatar(
  address: string | null | undefined
): AlgorandAvatarSelection | null {
  if (!address || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AlgorandAvatarSelection>;
    if (!parsed.imageUrl) return null;
    return { imageUrl: parsed.imageUrl, avatarValue: parsed.avatarValue };
  } catch {
    return null;
  }
}

function setCachedAlgorandAvatar(
  address: string,
  selection: AlgorandAvatarSelection
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(address), JSON.stringify(selection));
  } catch {
    // Ignore quota / availability errors — the API remains the durable store.
  }
}

/**
 * Persist an avatar selection for an Algorand address.
 *
 * Writes the local cache immediately (so the UI updates without waiting) and notifies the
 * DorkFi API. Never throws for API failures: the local cache keeps the choice usable.
 */
export async function saveAlgorandAvatar(
  address: string,
  selection: AlgorandAvatarSelection & { avatarValue: string }
): Promise<void> {
  setCachedAlgorandAvatar(address, selection);
  try {
    await dorkfiAPIService.setUserAvatar(address, {
      avatarValue: selection.avatarValue,
      imageUrl: selection.imageUrl,
      network: "algorand-mainnet",
    });
  } catch (error) {
    console.error("Failed to persist Algorand avatar to API:", error);
  }
}

/**
 * Fetch the durable avatar image URL for an address from the DorkFi API (cross-device source),
 * refreshing the local cache when found. Returns null if none is cached server-side.
 */
export async function fetchAlgorandAvatarFromApi(
  address: string
): Promise<string | null> {
  try {
    const res = await dorkfiAPIService.getUserAvatar(address);
    const url = res?.data?.avatar ?? null;
    if (url) {
      setCachedAlgorandAvatar(address, { imageUrl: url });
    }
    return url;
  } catch (error) {
    console.error("Failed to fetch Algorand avatar from API:", error);
    return null;
  }
}
