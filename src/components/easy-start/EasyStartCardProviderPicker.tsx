import { cn } from "@/lib/utils";

/** Card providers for Easy Start Deposit (on-ramp). Includes Stripe via useFiatOnramp. */
export const DEPOSIT_CARD_PROVIDERS = [
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
  {
    id: "stripe" as const,
    name: "Stripe",
    description: "Card · Apple / Google Pay",
  },
] as const;

export type DepositCardProvider = (typeof DEPOSIT_CARD_PROVIDERS)[number]["id"];

/** Off-ramp / cash-out providers (MoonPay + Coinbase only). */
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

/** Privy `fundWallet` preferred card/on-ramp provider (not Stripe — use useFiatOnramp). */
export type PrivyCardProvider = Extract<
  DepositCardProvider,
  "moonpay" | "coinbase"
>;

export function EasyStartCardProviderPicker({
  value,
  onChange,
  label = "Pay with",
  providers = CARD_PROVIDERS,
}: {
  value: string;
  onChange: (provider: string) => void;
  label?: string;
  providers?: ReadonlyArray<{
    id: string;
    name: string;
    description: string;
  }>;
}) {
  const cols =
    providers.length >= 3
      ? "grid-cols-3"
      : providers.length === 1
        ? "grid-cols-1"
        : "grid-cols-2";

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
        {label}
      </p>
      <div
        className={cn("grid gap-2", cols)}
        role="radiogroup"
        aria-label={label}
      >
        {providers.map((provider) => {
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
