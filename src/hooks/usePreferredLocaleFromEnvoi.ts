import { useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useAddressName } from "@/hooks/useAddressName";
import { useLocaleSettings } from "@/contexts/LocaleSettingsContext";
import { ResolverService } from "@/services/resolverService";
import { PREFERRED_LOCALE_KEY } from "./useSavePreferredLocaleToEnvoi";

/**
 * Valid BCP-47 for display: 2–35 chars, [a-z0-9-]. We accept up to 64 per spec.
 */
function isValidPreferredLocaleValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 64) return false;
  return /^[a-z0-9-]+$/.test(trimmed.toLowerCase());
}

/**
 * Fetches preferred_locale from the Envoi/VIP17 resolver on Voi mainnet and applies it
 * as the profile locale (used when mode is "profile"). Always fetches from Voi mainnet
 * regardless of current network (e.g. Algorand mainnet), so the user's saved locale
 * follows them across networks.
 */
export function usePreferredLocaleFromEnvoi() {
  const { activeAccount } = useWallet();
  const { name: addressName } = useAddressName(activeAccount?.address ?? null);
  const { setProfileLocale } = useLocaleSettings();

  useEffect(() => {
    if (!addressName || !activeAccount?.address) {
      setProfileLocale(null);
      return;
    }

    let cancelled = false;
    const resolver = new ResolverService("mainnet", activeAccount.address);

    resolver
      .text(addressName, PREFERRED_LOCALE_KEY)
      .then((value) => {
        if (cancelled) return;
        const raw = value?.trim?.() ?? "";
        if (raw && isValidPreferredLocaleValue(raw)) {
          setProfileLocale(raw.toLowerCase());
        } else {
          setProfileLocale(null);
        }
      })
      .catch(() => {
        if (!cancelled) setProfileLocale(null);
      });

    return () => {
      cancelled = true;
    };
  }, [addressName, activeAccount?.address, setProfileLocale]);
}
