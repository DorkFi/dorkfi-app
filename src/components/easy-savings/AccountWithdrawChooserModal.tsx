import { ArrowDownToLine, PiggyBank } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AccountWithdrawChooserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWithdrawFromEarn: boolean;
  canCashOut: boolean;
  onWithdrawFromEarn: () => void;
  onCashOut: () => void;
  consumerCopy: boolean;
};

const SHELL =
  "w-full max-w-[98vw] sm:max-w-md min-h-0 rounded-t-2xl sm:rounded-xl p-0 overflow-hidden flex flex-col";

function ChoiceButton({
  title,
  description,
  icon,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3.5 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-border/50 bg-muted/30 opacity-60"
          : "border-border bg-background hover:border-ocean-teal hover:bg-ocean-teal/5"
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}

const AccountWithdrawChooserModal = ({
  open,
  onOpenChange,
  canWithdrawFromEarn,
  canCashOut,
  onWithdrawFromEarn,
  onCashOut,
  consumerCopy,
}: AccountWithdrawChooserModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHELL}>
        <div className="px-5 pt-10 pb-6 sm:px-7 sm:pb-7 space-y-5">
          <DialogHeader className="space-y-2 text-center pr-6">
            <DialogTitle>Withdraw</DialogTitle>
            <DialogDescription>
              {consumerCopy
                ? "Move money out of Earn, or cash out from your account."
                : "Withdraw from savings, or cash out USDC from your account."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <ChoiceButton
              title="Withdraw from Earn"
              description={
                canWithdrawFromEarn
                  ? consumerCopy
                    ? "Move funds from Earn back to your account."
                    : "Withdraw supplied funds back to your wallet."
                  : consumerCopy
                    ? "Nothing in Earn yet."
                    : "No supplied balance to withdraw."
              }
              icon={<PiggyBank className="h-5 w-5" />}
              disabled={!canWithdrawFromEarn}
              onClick={onWithdrawFromEarn}
            />
            <ChoiceButton
              title="Cash Out"
              description={
                canCashOut
                  ? consumerCopy
                    ? "Send money from your account to a debit card or bank."
                    : "Off-ramp USDC from your account to a card or bank."
                  : consumerCopy
                    ? "Nothing available to cash out. Withdraw from Earn first if funds are still earning."
                    : "No USDC available to cash out. Withdraw from savings first."
              }
              icon={<ArrowDownToLine className="h-5 w-5" />}
              disabled={!canCashOut}
              onClick={onCashOut}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccountWithdrawChooserModal;
