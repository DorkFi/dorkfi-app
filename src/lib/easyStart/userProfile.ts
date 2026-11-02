/**
 * Easy Start preferred name + avatar (local, per wallet address).
 * Shared by the account menu and Account / Edit profile UI.
 */

export type EasyStartUserProfile = {
  preferredName: string;
  /** Emoji or short avatar glyph */
  avatar: string;
};

export const EASY_START_AVATARS = [
  "🌻",
  "😀",
  "🚀",
  "🏝️",
  "🐶",
  "🌲",
  "☕",
  "❤️",
] as const;

export const DEFAULT_EASY_START_AVATAR = EASY_START_AVATARS[0];

const STORAGE_PREFIX = "easy-start-user-profile:";
export const EASY_START_PROFILE_EVENT = "easy-start-user-profile-updated";

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey.toLowerCase()}`;
}

export function profileStorageKey(userKey: string | null | undefined): string | null {
  if (!userKey?.trim()) return null;
  return storageKey(userKey.trim());
}

export function readEasyStartProfile(
  userKey: string | null | undefined
): EasyStartUserProfile | null {
  const key = profileStorageKey(userKey);
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EasyStartUserProfile>;
    const preferredName =
      typeof parsed.preferredName === "string" ? parsed.preferredName.trim() : "";
    const avatar =
      typeof parsed.avatar === "string" && parsed.avatar.trim()
        ? parsed.avatar.trim()
        : DEFAULT_EASY_START_AVATAR;
    if (!preferredName && !parsed.avatar) return null;
    return {
      preferredName,
      avatar,
    };
  } catch {
    return null;
  }
}

export function writeEasyStartProfile(
  userKey: string,
  profile: EasyStartUserProfile
): void {
  const key = profileStorageKey(userKey);
  if (!key || typeof window === "undefined") return;
  const next: EasyStartUserProfile = {
    preferredName: profile.preferredName.trim(),
    avatar: profile.avatar.trim() || DEFAULT_EASY_START_AVATAR,
  };
  window.localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(EASY_START_PROFILE_EVENT, { detail: { key } })
  );
}

/** Display name: saved preferred name → Privy default → fallback. */
export function resolveEasyStartDisplayName(
  userKey: string | null | undefined,
  privyDisplayName: string | null | undefined,
  fallback = "Account"
): string {
  const saved = readEasyStartProfile(userKey)?.preferredName;
  if (saved) return saved;
  if (privyDisplayName?.trim()) return privyDisplayName.trim();
  return fallback;
}

export function resolveEasyStartAvatar(
  userKey: string | null | undefined
): string | null {
  return readEasyStartProfile(userKey)?.avatar ?? null;
}
