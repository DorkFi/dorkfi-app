import React from "react";
import { Check, CheckCircle2, Sparkles } from "lucide-react";
import DorkFiButton from "@/components/ui/DorkFiButton";
import LpPairIconStack from "@/components/pools/LpPairIconStack";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { consumerAssetDisplayLabel } from "@/services/savingsRouteResolver";

interface SupplyBorrowCongratsProps {
  transactionType: "deposit" | "borrow" | "withdraw" | "repay";
  asset: string;
  assetIcon: string;
  /** Underlying pair icons for LP markets (preferred over `assetIcon` when set). */
  assetPairIcons?: { asset1Icon: string; asset2Icon: string };
  amount: string;
  onViewTransaction: () => void;
  onGoToPortfolio: () => void;
  onMakeAnother: () => void;
  onClose: () => void;
  /** When true, disables “View transaction” (e.g. no tx id yet). */
  viewTransactionDisabled?: boolean;
  /** Rendered above the primary action buttons (e.g. share CTA). */
  aboveActions?: React.ReactNode;
}

const MAKE_ANOTHER_LABEL: Record<
  SupplyBorrowCongratsProps["transactionType"],
  string
> = {
  borrow: "Make another borrow",
  deposit: "Make another deposit",
  withdraw: "Make another withdrawal",
  repay: "Make another repay",
};

function formatPacificDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("year")} · ${get("hour")}:${get("minute")} ${get("dayPeriod")} PT`;
}

function formatConsumerAmount(amount: string, assetLabel: string): string {
  const numeric = amount.trim().replace(/^\$/, "");
  const isUsd = /\bUSD\b/i.test(assetLabel) && !/\bLP\b/i.test(assetLabel);
  return isUsd ? `$${numeric} ${assetLabel}` : `${numeric} ${assetLabel}`;
}

const SupplyBorrowCongrats: React.FC<SupplyBorrowCongratsProps> = ({
  transactionType,
  asset,
  assetIcon,
  assetPairIcons,
  amount,
  onViewTransaction,
  onGoToPortfolio,
  onMakeAnother,
  onClose,
  viewTransactionDisabled = false,
  aboveActions,
}) => {
  const consumerCopy = useConsumerCopy();
  const completedAt = React.useMemo(() => new Date(), []);
  const getTransactionMessage = () => {
    switch (transactionType) {
      case "deposit":
        return { action: "deposited", preposition: "to" };
      case "borrow":
        return { action: "borrowed", preposition: "from" };
      case "withdraw":
        return { action: "withdrew", preposition: "from" };
      case "repay":
        return { action: "repaid", preposition: "to" };
      default:
        return { action: "processed", preposition: "with" };
    }
  };

  const { action, preposition } = getTransactionMessage();
  const displayAsset = consumerCopy
    ? consumerAssetDisplayLabel(asset)
    : asset;
  const assetLabel = assetPairIcons ? `${displayAsset} LP` : displayAsset;

  if (consumerCopy) {
    return (
      <div className="flex w-full flex-col items-center text-center animate-fade-in">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#E5F8EF]">
          <Check
            className="h-9 w-9 text-[#4ADE80]"
            strokeWidth={2.5}
            aria-hidden
          />
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Transaction complete
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          You successfully {action}
        </p>
        <p className="mt-3 text-3xl font-semibold leading-none text-ocean-teal">
          {formatConsumerAmount(amount, assetLabel)}
        </p>

        <div className="mt-6 w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-slate-500">Asset</span>
            <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
              {assetPairIcons ? (
                <LpPairIconStack
                  asset1Icon={assetPairIcons.asset1Icon}
                  asset2Icon={assetPairIcons.asset2Icon}
                  fallbackIcon={assetIcon}
                  alt={asset}
                  size="sm"
                />
              ) : (
                <img
                  src={assetIcon}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              )}
              {assetLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <span className="text-sm text-slate-500">Date & time</span>
            <span className="text-sm font-medium text-slate-800">
              {formatPacificDateTime(completedAt)}
            </span>
          </div>
        </div>

        {aboveActions}

        <DorkFiButton
          variant="primary"
          size="lg"
          className="mt-6 w-full rounded-xl bg-ocean-teal text-base hover:bg-ocean-teal/90"
          onClick={onMakeAnother}
        >
          {MAKE_ANOTHER_LABEL[transactionType]}
        </DorkFiButton>

        <button
          type="button"
          className="mt-3 text-sm font-medium text-ocean-teal underline underline-offset-2 transition-colors hover:text-ocean-teal/80"
          onClick={onGoToPortfolio}
        >
          View portfolio
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 animate-fade-in">
      {/* Confetti & Sparkles */}
      <div className="relative flex flex-col items-center justify-center mb-2">
        <Sparkles className="absolute -top-3 -left-3 text-whale-gold w-7 h-7 animate-bounce" />
        <Sparkles className="absolute -top-3 -right-3 text-highlight-aqua w-7 h-7 animate-bounce animation-delay-300" />
        <CheckCircle2 className="w-16 h-16 text-green-500 drop-shadow-xl bg-white dark:bg-slate-800 rounded-full p-1 border-4 border-whale-gold z-10" />
        <div className="mt-[-30px] mx-auto flex h-32 w-32 items-center justify-center rounded-xl border-4 border-whale-gold bg-bubble-white shadow-md dark:bg-slate-800">
          {assetPairIcons ? (
            <LpPairIconStack
              asset1Icon={assetPairIcons.asset1Icon}
              asset2Icon={assetPairIcons.asset2Icon}
              fallbackIcon={assetIcon}
              alt={asset}
              size="md"
              className="scale-[2.2]"
            />
          ) : (
            <img
              src={assetIcon}
              alt={`${asset} icon`}
              className="h-24 w-24 rounded-lg object-contain"
            />
          )}
        </div>
      </div>

      <h2 className="text-xl font-bold text-center mb-1">
        Transaction Successful!
      </h2>

      <div className="text-center text-base text-slate-700 dark:text-slate-200 mb-2 font-medium">
        You successfully {action}{" "}
        <span className="text-whale-gold">
          {amount} {assetLabel}
        </span>
        {` ${preposition} the protocol.`}
      </div>

      {aboveActions}

      <div className="flex flex-col gap-2 w-full mt-2">
        <DorkFiButton
          variant="primary"
          className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white rounded-xl py-3 text-lg"
          onClick={onViewTransaction}
          disabled={viewTransactionDisabled}
        >
          View Transaction
        </DorkFiButton>

        <DorkFiButton
          variant="secondary"
          className="w-full border-ocean-teal text-ocean-teal dark:border-whale-gold dark:text-whale-gold"
          onClick={onMakeAnother}
        >
          Make Another Transaction
        </DorkFiButton>
      </div>

      <button
        type="button"
        className="text-xs underline text-slate-500 dark:text-slate-300 hover:text-slate-800 hover:dark:text-white mt-2 transition-colors"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
};

export default SupplyBorrowCongrats;
