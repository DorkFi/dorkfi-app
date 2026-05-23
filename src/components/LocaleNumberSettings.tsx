import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Loader2 } from "lucide-react";

const MANUAL_LOCALE_LABELS: Record<ManualLocale, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "de-DE": "Deutsch (DE)",
  "fr-FR": "Français (FR)",
  "es-ES": "Español (ES)",
  "pt-BR": "Português (BR)",
};

/** Display BCP-47 tag for UI (e.g. de-de → de-DE). */
function formatLocaleForDisplay(tag: string): string {
  const parts = tag.toLowerCase().split("-");
  if (parts.length >= 2 && parts[1].length === 2) {
    parts[1] = parts[1].toUpperCase();
  }
  return parts.join("-");
}

export function LocaleNumberSettings() {
  const {
    settings,
    setMode,
    setManualLocale,
    setProfileLocale,
    supportedManualLocales,
    effectiveLocale,
    profileLocale,
  } = useLocaleSettings();
  const { savePreferredLocaleToEnvoi, isSaving, canSave } = useSavePreferredLocaleToEnvoi();
  const { toast } = useToast();

  // When on VOI with Envoi name, fetch preferred_locale from profile and use it (auto mode).
  usePreferredLocaleFromEnvoi();

  // Don't show save when manual selection already matches profile (nothing to save).
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
        description: err instanceof Error ? err.message : "Could not save locale to Envoi profile.",
        variant: "destructive",
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Number format / locale"
        >
          <Globe className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
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
              <RadioGroupItem value="auto" id="locale-auto" />
              <Label htmlFor="locale-auto" className="text-sm font-normal cursor-pointer">
                Auto (browser)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="profile" id="locale-profile" />
              <Label htmlFor="locale-profile" className="text-sm font-normal cursor-pointer">
                Preferred locale (profile)
                {profileLocale ? `: ${formatLocaleForDisplay(profileLocale)}` : " (save to Envoi to set)"}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="manual" id="locale-manual" />
              <Label htmlFor="locale-manual" className="text-sm font-normal cursor-pointer">
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
          {showSave && (
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleSaveToEnvoi}
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
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
