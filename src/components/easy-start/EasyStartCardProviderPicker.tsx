import { cn } from "@/lib/utils";

export const CARD_PROVIDERS = [
  {
    id: "moonpay" as const,
    name: "MoonPay",
    description: "Card · Apple Pay",
  },
  {
    id: "coinbase" as const,
    name: "Coinbase",
    description: "Card · Coinbase account",
  },
] as const;

export type CardProvider = (typeof CARD_PROVIDERS)[number]["id"];

/** Privy `fundWallet` preferred card/on-ramp provider. */
export type PrivyCardProvider = CardProvider;

export function EasyStartCardProviderPicker({
  value,
  onChange,
  label = "Pay with",
}: {
  value: CardProvider;
  onChange: (provider: CardProvider) => void;
  label?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
        {label}
      </p>
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label={label}
      >
        {CARD_PROVIDERS.map((provider) => {
          const selected = value === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(provider.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                selected
                  ? "border-ocean-teal bg-ocean-teal/10"
                  : "border-gray-200/80 dark:border-slate-600 hover:bg-white/50 dark:hover:bg-slate-700/50"
              )}
            >
              <span
                className={cn(
                  "block text-sm font-semibold",
                  selected
                    ? "text-ocean-teal"
                    : "text-slate-800 dark:text-white"
                )}
              >
                {provider.name}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                {provider.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Open a provider sell/cash-out page; prefer EasyStartOfframpCashOut for in-app flow. */
export function openCardProviderCashOut(provider: CardProvider): void {
  const url =
    provider === "coinbase"
      ? "https://pay.coinbase.com/"
      : "https://www.moonpay.com/sell";
  window.open(url, "_blank", "noopener,noreferrer");
}
