import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import {
  getLocaleSettings,
  setLocaleSettings,
  getEffectiveLocale,
  type LocaleSettings,
  type LocaleMode,
  type ManualLocale,
  SUPPORTED_MANUAL_LOCALES,
} from "@/utils/localeSettings";
import {
  formatNumber as formatNumberUtil,
  parseNumber as parseNumberUtil,
  formatCurrency as formatCurrencyUtil,
  formatPercent as formatPercentUtil,
  type FormatNumberOptions,
  type FormatCurrencyOptions,
  type FormatPercentOptions,
} from "@/utils/numberI18n";

interface LocaleSettingsContextType {
  settings: LocaleSettings;
  effectiveLocale: string;
  /** When in "profile" mode and set, used as effective locale (e.g. from Envoi preferred_locale). */
  profileLocale: string | null;
  setProfileLocale: (locale: string | null) => void;
  setMode: (mode: LocaleMode) => void;
  setManualLocale: (locale: ManualLocale) => void;
  supportedManualLocales: readonly ManualLocale[];
}

const LocaleSettingsContext = createContext<
  LocaleSettingsContextType | undefined
>(undefined);

interface LocaleSettingsProviderProps {
  children: ReactNode;
}

export const LocaleSettingsProvider: React.FC<LocaleSettingsProviderProps> = ({
  children,
}) => {
  const [settings, setSettingsState] = useState<LocaleSettings>(() =>
    getLocaleSettings()
  );
  const [profileLocale, setProfileLocale] = useState<string | null>(null);
  const effectiveLocale = useMemo(() => {
    if (settings.mode === "profile" && profileLocale && profileLocale.length >= 2) {
      return profileLocale;
    }
    return getEffectiveLocale(settings);
  }, [settings, profileLocale]);

  useEffect(() => {
    setLocaleSettings(settings);
  }, [settings]);

  const setMode = useCallback((mode: LocaleMode) => {
    setSettingsState((prev) => ({ ...prev, mode }));
  }, []);

  const setManualLocale = useCallback((manualLocale: ManualLocale) => {
    setSettingsState((prev) => ({ ...prev, manualLocale, mode: "manual" }));
  }, []);

  const value: LocaleSettingsContextType = {
    settings,
    effectiveLocale,
    profileLocale,
    setProfileLocale,
    setMode,
    setManualLocale,
    supportedManualLocales: SUPPORTED_MANUAL_LOCALES,
  };

  return (
    <LocaleSettingsContext.Provider value={value}>
      {children}
    </LocaleSettingsContext.Provider>
  );
};

export function useLocaleSettings(): LocaleSettingsContextType {
  const context = useContext(LocaleSettingsContext);
  if (!context) {
    throw new Error(
      "useLocaleSettings must be used within a LocaleSettingsProvider"
    );
  }
  return context;
}

/** Hook that returns locale-aware number format/parse functions using current effective locale. */
export function useNumberI18n() {
  const { effectiveLocale } = useLocaleSettings();
  return useMemo(
    () => ({
      formatNumber: (value: number, options?: FormatNumberOptions) =>
        formatNumberUtil(value, options, effectiveLocale),
      parseNumber: (input: string) => parseNumberUtil(input, effectiveLocale),
      formatCurrency: (
        value: number,
        currencyCode: string,
        options?: FormatCurrencyOptions
      ) => formatCurrencyUtil(value, currencyCode, options, effectiveLocale),
      formatPercent: (value: number, options?: FormatPercentOptions) =>
        formatPercentUtil(value, options, effectiveLocale),
      effectiveLocale,
    }),
    [effectiveLocale]
  );
}
