import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Globe, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocaleSettings } from "@/contexts/LocaleSettingsContext";
import { type LocaleMode, type ManualLocale } from "@/utils/localeSettings";
import { useSavePreferredLocaleToEnvoi } from "@/hooks/useSavePreferredLocaleToEnvoi";
import { usePreferredLocaleFromEnvoi } from "@/hooks/usePreferredLocaleFromEnvoi";
import { useToast } from "@/hooks/use-toast";

const MANUAL_LOCALE_LABELS: Record<ManualLocale, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "de-DE": "Deutsch (DE)",
  "fr-FR": "Français (FR)",
  "es-ES": "Español (ES)",
  "pt-BR": "Português (BR)",
};

function formatLocaleForDisplay(tag: string): string {
  const parts = tag.toLowerCase().split("-");
  if (parts.length >= 2 && parts[1].length === 2) {
    parts[1] = parts[1].toUpperCase();
  }
  return parts.join("-");
}

/**
 * Theme + number-format controls for account / Get Started dropdowns
 * (host header chrome no longer exposes them as separate icon buttons).
 */
export function AppSettingsMenuSection() {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Settings
      </DropdownMenuLabel>
      <ThemeSettingsMenuItem />
      <LocaleSettingsMenuSub />
    </>
  );
}

function ThemeSettingsMenuItem() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <DropdownMenuItem disabled className="cursor-default">
        <Sun className="mr-2 h-4 w-4" />
        Theme
      </DropdownMenuItem>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onSelect={(e) => {
        e.preventDefault();
        setTheme(isDark ? "light" : "dark");
      }}
    >
      {isDark ? (
        <Sun className="mr-2 h-4 w-4" />
      ) : (
        <Moon className="mr-2 h-4 w-4" />
      )}
      {isDark ? "Light mode" : "Dark mode"}
    </DropdownMenuItem>
  );
}

function LocaleSettingsMenuSub() {
  const {
    settings,
    setMode,
    setManualLocale,
    setProfileLocale,
    supportedManualLocales,
    effectiveLocale,
    profileLocale,
  } = useLocaleSettings();
  const { savePreferredLocaleToEnvoi, isSaving, canSave } =
    useSavePreferredLocaleToEnvoi();
  const { toast } = useToast();

  usePreferredLocaleFromEnvoi();

  const manualMatchesProfile =
    settings.mode === "manual" &&
    profileLocale &&
    settings.manualLocale.toLowerCase() === profileLocale.toLowerCase();
  const showSave = canSave && !manualMatchesProfile;

  const handleSaveToEnvoi = async () => {
    try {
      await savePreferredLocaleToEnvoi();
      setProfileLocale(effectiveLocale.toLowerCase());
      toast({
        title: "Locale saved to profile",
        description: `Your preferred locale (${effectiveLocale}) has been saved to your Envoi profile.`,
      });
    } catch (err) {
      toast({
        title: "Failed to save",
        description:
          err instanceof Error
            ? err.message
            : "Could not save locale to Envoi profile.",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer">
        <Globe className="mr-2 h-4 w-4" />
        Number format
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-72 p-3" sideOffset={8}>
        <div
          className="space-y-4"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div>
            <h4 className="font-medium text-sm mb-1">Number format</h4>
            <p className="text-xs text-muted-foreground">
              Auto uses your browser locale. Default fallback is en-US.
            </p>
          </div>
          <RadioGroup
            value={settings.mode}
            onValueChange={(v) => setMode(v as LocaleMode)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="auto" id="menu-locale-auto" />
              <Label
                htmlFor="menu-locale-auto"
                className="text-sm font-normal cursor-pointer"
              >
                Auto (browser)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="profile" id="menu-locale-profile" />
              <Label
                htmlFor="menu-locale-profile"
                className="text-sm font-normal cursor-pointer"
              >
                Preferred locale (profile)
                {profileLocale
                  ? `: ${formatLocaleForDisplay(profileLocale)}`
                  : " (save to Envoi to set)"}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="manual" id="menu-locale-manual" />
              <Label
                htmlFor="menu-locale-manual"
                className="text-sm font-normal cursor-pointer"
              >
                Manual
              </Label>
            </div>
          </RadioGroup>
          {settings.mode === "manual" && (
            <div className="space-y-2">
              <Label className="text-sm">Locale</Label>
              <Select
                value={settings.manualLocale}
                onValueChange={(v) => setManualLocale(v as ManualLocale)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {supportedManualLocales.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {MANUAL_LOCALE_LABELS[loc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {showSave ? (
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => void handleSaveToEnvoi()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save locale to Envoi profile"
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5">
                Writes preferred locale to your Envoi name on Voi Network.
              </p>
            </div>
          ) : null}
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
