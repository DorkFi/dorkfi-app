import * as React from "react";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { FormatNumberOptions } from "@/utils/numberI18n";

export interface LocaleNumberInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type"
  > {
  value: number | "";
  onChange: (value: number | null) => void;
  formatOptions?: FormatNumberOptions;
  showValidationMessage?: boolean;
}

/**
 * Number input that displays and parses values using the user's numeric locale.
 * Stores canonical numeric value internally; displays with locale formatting.
 * On blur/change, parses input and calls onChange(number | null). Invalid/ambiguous
 * input surfaces via validation message when showValidationMessage is true.
 */
export const LocaleNumberInput = React.forwardRef<
  HTMLInputElement,
  LocaleNumberInputProps
>(
  (
    {
      value,
      onChange,
      formatOptions,
      showValidationMessage = true,
      onBlur,
      onFocus,
      className,
      ...props
    },
    ref
  ) => {
    const { formatNumber, parseNumber } = useNumberI18n();
    const [displayValue, setDisplayValue] = React.useState("");
    const [isFocused, setIsFocused] = React.useState(false);
    const [lastValidValue, setLastValidValue] = React.useState<number | "">(value);

    const formatForDisplay = React.useCallback(
      (n: number | "") => {
        if (n === "" || (typeof n === "number" && n !== n)) return "";
        return formatNumber(n, formatOptions ?? { maximumFractionDigits: 2 });
      },
      [formatNumber, formatOptions]
    );

    // Sync display from parent whenever value changes (e.g. MAX/quick-amount buttons).
    // Parent value only changes on blur (onChange) or button clicks, never while user is typing,
    // so this won't overwrite in-progress input.
    React.useEffect(() => {
      const formatted = formatForDisplay(value === "" ? "" : value);
      setDisplayValue(formatted);
      setLastValidValue(value);
    }, [value, formatForDisplay]);

    const handleFocus: React.FocusEventHandler<HTMLInputElement> = (e) => {
      setIsFocused(true);
      setDisplayValue(
        value === "" ? "" : formatForDisplay(value)
      );
      onFocus?.(e);
    };

    const handleBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
      setIsFocused(false);
      const parsed = parseNumber(displayValue);
      if (parsed !== null) {
        setLastValidValue(parsed);
        onChange(parsed);
        setDisplayValue(formatForDisplay(parsed));
      } else if (displayValue.trim() === "") {
        setLastValidValue("");
        onChange(null);
        setDisplayValue("");
      } else {
        setDisplayValue(formatForDisplay(lastValidValue === "" ? "" : lastValidValue));
      }
      onBlur?.(e);
    };

    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
      setDisplayValue(e.target.value);
    };

    const parsed = parseNumber(displayValue);
    const isEmpty = displayValue.trim() === "";
    const isValid = isEmpty || parsed !== null;
    const showError = showValidationMessage && !isFocused && !isEmpty && parsed === null;

    return (
      <div className="space-y-1">
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(showError && "border-destructive focus-visible:ring-destructive")}
          {...props}
        />
        {showError && (
          <p className="text-xs text-destructive">
            Invalid or ambiguous number for current locale. Use your locale&apos;s decimal and grouping separators.
          </p>
        )}
      </div>
    );
  }
);
LocaleNumberInput.displayName = "LocaleNumberInput";
