import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  EASY_START_PROFILE_EVENT,
  readEasyStartProfile,
  writeEasyStartProfile,
  type EasyStartUserProfile,
} from "@/lib/easyStart/userProfile";
import { usePrivyEasyStart } from "@/contexts/PrivySessionProvider";

function subscribe(onStoreChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("easy-start-user-profile:")) onStoreChange();
  };
  const onCustom = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EASY_START_PROFILE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EASY_START_PROFILE_EVENT, onCustom);
  };
}

/**
 * Preferred name / avatar for the signed-in Easy Start user (localStorage).
 * Keyed by Algorand address when available, else EVM address.
 */
export function useEasyStartUserProfile() {
  const privy = usePrivyEasyStart();
  const userKey = privy.algorandAddress ?? privy.evmAddress ?? null;

  // Stable string snapshot avoids infinite re-render from new object identities.
  const profileJson = useSyncExternalStore(
    subscribe,
    () => {
      const p = readEasyStartProfile(userKey);
      return p ? JSON.stringify(p) : "";
    },
    () => ""
  );

  const profile = useMemo((): EasyStartUserProfile | null => {
    if (!profileJson) return null;
    try {
      return JSON.parse(profileJson) as EasyStartUserProfile;
    } catch {
      return null;
    }
  }, [profileJson]);

  const preferredName = profile?.preferredName?.trim() || "";
  const displayName =
    preferredName || privy.displayName?.trim() || "Account";
  const avatar = profile?.avatar?.trim() || null;

  const saveProfile = useCallback(
    (next: EasyStartUserProfile) => {
      if (!userKey) return;
      writeEasyStartProfile(userKey, next);
    },
    [userKey]
  );

  return {
    userKey,
    profile,
    displayName,
    avatar,
    saveProfile,
    privyDisplayName: privy.displayName,
  };
}
