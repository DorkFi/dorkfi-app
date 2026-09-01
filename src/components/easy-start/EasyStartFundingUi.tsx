import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Lock,
  Pencil,
  Percent,
  Plus,
  Shield,
  Wallet,
  Zap,
} from "lucide-react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const EASY_START_FUNDING_DIALOG_CLASS =
  "bg-background text-foreground rounded-2xl border border-border/60 shadow-xl max-w-[95vw] md:max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-x-hidden overflow-y-auto flex flex-col p-0 overscroll-contain";

export function WalletPlusMark({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ocean-teal/15 text-ocean-teal",
        className
      )}
      aria-hidden
    >
      <Wallet className="h-7 w-7" />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ocean-teal text-white">
        <Plus className="h-3 w-3" strokeWidth={3} />
      </span>
    </span>
  );
}

export function FundingSheetHeader({
  title,
  subtitle,
  onBack,
  icon = <WalletPlusMark />,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="relative px-6 pt-5 pb-2 shrink-0">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="absolute left-4 top-4 z-20 rounded-sm p-1 text-muted-foreground opacity-80 hover:opacity-100 hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      ) : null}
      <DialogHeader className="pb-0 space-y-2 text-center">
        <div className="flex justify-center pt-1">{icon}</div>
        <DialogTitle className="text-2xl font-bold tracking-tight">
          {title}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {subtitle}
        </DialogDescription>
      </DialogHeader>
    </div>
  );
}

export function AmountPresets({
  amounts,
  value,
  onChange,
  disabledAmount,
}: {
  amounts: readonly string[];
  value: string;
  onChange: (amount: string) => void;
  disabledAmount?: (amount: string) => boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {amounts.map((preset) => {
        const selected = value === preset;
        const disabled = disabledAmount?.(preset) ?? false;
        return (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset)}
            className={cn(
              "rounded-xl border py-2.5 text-sm font-semibold transition-colors disabled:opacity-40",
              selected
                ? "border-ocean-teal bg-ocean-teal/10 text-ocean-teal"
                : "border-border bg-background hover:bg-muted/50 text-foreground"
            )}
          >
            ${preset}
          </button>
        );
      })}
    </div>
  );
}

export function AmountHero({
  id,
  amount,
  onChange,
  editing,
  onEditingChange,
  display,
  min = 1,
  step = 1,
}: {
  id: string;
  amount: string;
  onChange: (next: string) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  display: string;
  min?: number;
  step?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="relative rounded-xl border border-ocean-teal bg-background px-4 py-3">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-bold text-foreground">
          $
        </span>
        <input
          ref={inputRef}
          id={id}
          type="number"
          min={min}
          step={step}
          value={amount}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onEditingChange(false)}
          className="w-full bg-transparent pl-7 pr-10 text-center text-3xl font-bold tabular-nums text-foreground focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onEditingChange(true)}
      className="relative flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-3.5 hover:border-ocean-teal/50 transition-colors"
      aria-label="Edit amount"
    >
      <span className="text-3xl font-bold tabular-nums text-foreground">
        {display}
      </span>
      <Pencil className="absolute right-4 h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function TrustInline({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start justify-center gap-1.5 text-center text-xs text-muted-foreground">
      <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ocean-teal" />
      <span>{children}</span>
    </p>
  );
}

export type PayMethodOption = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  badge?: string;
  tag?: { label: string; tone: "fast" | "muted" };
};

export function PayMethodList({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly PayMethodOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="space-y-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                selected
                  ? "border-ocean-teal bg-ocean-teal/5"
                  : "border-border bg-background hover:bg-muted/40"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      selected ? "text-ocean-teal" : "text-foreground"
                    )}
                  >
                    {option.title}
                  </span>
                  {option.badge ? (
                    <span className="rounded-full bg-ocean-teal/15 px-2 py-0.5 text-[10px] font-semibold text-ocean-teal">
                      {option.badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
              {option.tag ? (
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline",
                    option.tag.tone === "fast"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {option.tag.label}
                </span>
              ) : null}
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  selected
                    ? "border-ocean-teal bg-ocean-teal text-white"
                    : "border-muted-foreground/30"
                )}
                aria-hidden
              >
                {selected ? <Check className="h-3 w-3" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewPayWithCard({
  icon,
  title,
  tags,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  tags: readonly { label: string; icon?: ReactNode }[];
  onChange: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          {icon}
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold">{title}</span>
        <button
          type="button"
          onClick={onChange}
          className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Change
        </button>
      </div>
      {tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.label}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {tag.icon}
              {tag.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReviewBreakdown({
  amountLabel,
  amountValue,
  feeLabel,
  feeValue,
  receiveLabel,
  receiveValue,
  footnote,
}: {
  amountLabel: string;
  amountValue: string;
  feeLabel: string;
  feeValue: string;
  receiveLabel: string;
  receiveValue: string;
  footnote: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3.5 space-y-2.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{amountLabel}</span>
        <span className="font-medium tabular-nums">{amountValue}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          {feeLabel}
          <Info className="h-3 w-3" aria-hidden />
        </span>
        <span className="font-medium text-muted-foreground">{feeValue}</span>
      </div>
      <div className="border-t border-border pt-2.5">
        <p className="text-lg font-bold tabular-nums text-ocean-teal">
          {receiveLabel} {receiveValue}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{footnote}</p>
      </div>
    </div>
  );
}

export function ChooseSummary({
  addLabel,
  feeLabel,
  receiveLabel,
}: {
  addLabel: string;
  feeLabel: string;
  receiveLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm space-y-1">
      <p className="text-muted-foreground">{addLabel}</p>
      <p className="text-muted-foreground">{feeLabel}</p>
      <p className="font-semibold text-ocean-teal">{receiveLabel}</p>
    </div>
  );
}

const DEFAULT_TRUST_ITEMS = [
  {
    icon: <Shield className="h-4 w-4" />,
    title: "Secure",
    body: "Your payment is encrypted and protected by bank-level security.",
  },
  {
    icon: <Wallet className="h-4 w-4" />,
    title: "Your money, always under your control",
    body: "You can withdraw or borrow against your savings anytime.",
  },
  {
    icon: <Percent className="h-4 w-4" />,
    title: "Start earning",
    body: "Once funds arrive, add them to savings whenever you’re ready to earn.",
  },
] as const;

export function TrustValueList({
  items = DEFAULT_TRUST_ITEMS,
}: {
  items?: readonly { icon: ReactNode; title: string; body: string }[];
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.title} className="flex gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ocean-teal/15 text-ocean-teal">
            {item.icon}
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">
              {item.title}
            </span>
            <span className="block text-xs text-muted-foreground">
              {item.body}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TermsNote() {
  return (
    <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
      By continuing you agree to SimplFi’s{" "}
      <Link
        to="/terms"
        className="font-medium text-ocean-teal underline-offset-2 hover:underline"
      >
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link
        to="/privacy"
        className="font-medium text-ocean-teal underline-offset-2 hover:underline"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}

export function PrivySecureNote() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
      <Lock className="h-3 w-3" />
      Powered by Privy. Your payment details are secure.
    </p>
  );
}

export function SecuredByPrivy() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
      <Lock className="h-3 w-3" />
      Secured by Privy
    </p>
  );
}

export function FundingPrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <Button
      type={type}
      className="h-12 w-full rounded-xl bg-ocean-teal text-base font-semibold text-white hover:bg-ocean-teal/90"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ContinueLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      <ArrowRight className="h-4 w-4" />
    </span>
  );
}

export function InstantTagIcon() {
  return <Zap className="h-3 w-3 text-amber-500" aria-hidden />;
}

export function ApplePayGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}
