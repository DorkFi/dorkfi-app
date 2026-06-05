import React from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import DorkFiButton from "@/components/ui/DorkFiButton";
import LpPairIconStack from "@/components/pools/LpPairIconStack";

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
}) => {
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
          {amount} {asset}
        </span>{" "}
        {preposition} the protocol.
      </div>

      <div className="flex flex-col gap-2 w-full mt-2">
        <DorkFiButton
          variant="primary"
          className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white rounded-xl py-3 text-lg"
          onClick={onViewTransaction}
          disabled={viewTransactionDisabled}
        >
          View Transaction
        </DorkFiButton>

        {/*<DorkFiButton
          variant="secondary"
          className="w-full border-ocean-teal text-ocean-teal dark:border-whale-gold dark:text-whale-gold"
          onClick={onGoToPortfolio}
        >
          Go to Portfolio
        </DorkFiButton>*/}

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
