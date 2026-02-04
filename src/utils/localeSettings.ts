/**
 * User-controllable numeric locale settings.
 * Persisted in localStorage; effective locale is either browser (auto) or manual.
 */

const LOCALE_STORAGE_KEY = "dorkfi-number-locale";

export type LocaleMode = "auto" | "profile" | "manual";

export const SUPPORTED_MANUAL_LOCALES = [
  "en-US",
  "en-GB",
  "de-DE",
  "fr-FR",
  "es-ES",
  "pt-BR",
] as const;

export type ManualLocale = (typeof SUPPORTED_MANUAL_LOCALES)[number];

export interface LocaleSettings {
  mode: LocaleMode;
  manualLocale: ManualLocale;
}

const DEFAULT_SETTINGS: LocaleSettings = {
  mode: "auto",
  manualLocale: "en-US",
};

const FALLBACK_LOCALE = "en-US";

function isValidManualLocale(value: string): value is ManualLocale {
  return (SUPPORTED_MANUAL_LOCALES as readonly string[]).includes(value);
}

/**
 * Load locale settings from localStorage.
 */
export function getLocaleSettings(): LocaleSettings {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LocaleSettings>;
    return {
      mode: parsed.mode === "manual" ? "manual" : parsed.mode === "profile" ? "profile" : "auto",
      manualLocale: isValidManualLocale(parsed.manualLocale)
        ? parsed.manualLocale
        : DEFAULT_SETTINGS.manualLocale,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save locale settings to localStorage.
 */
export function setLocaleSettings(settings: LocaleSettings): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save locale settings", e);
  }
}

/**
 * Get the effective BCP-47 locale for number formatting/parsing.
 * - mode "auto": use navigator.language (or first language); fallback en-US.
 * - mode "manual": use manualLocale; if unset/invalid, fallback en-US.
 * Safe to call in SSR (returns en-US when navigator is undefined).
 */
export function getEffectiveLocale(settings?: LocaleSettings | null): string {
  const s = settings ?? getLocaleSettings();
  if (s.mode === "manual") {
    return s.manualLocale;
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    const browser = navigator.language;
    if (browser.length >= 2) return browser;
  }
  return FALLBACK_LOCALE;
}
