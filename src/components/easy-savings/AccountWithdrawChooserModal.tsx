import { ArrowDownToLine, PiggyBank } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cashOutEmptyDescription } from "@/lib/easyStart/cashOutBuckets";
import { cn } from "@/lib/utils";

type AccountWithdrawChooserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWithdrawFromEarn: boolean;
  canCashOut: boolean;
  /** Base USDC. When cash out is enabled and this is empty, the next step moves funds first. */
  baseUsd?: number;
  /** Supplied Earn balance. Used only for the disabled Cash out message. */
  earnUsd?: number;
  /** Algorand wallet USDC that has already left Earn. */
  algorandUsd?: number;
  /** Redeemed USDC is still on Algorand and needs the Base swap. */
  finishEarnMove?: boolean;
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
  baseUsd = 0,
  earnUsd = 0,
  algorandUsd = 0,
  finishEarnMove = false,
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
            {finishEarnMove ? (
              <p className="rounded-xl border border-ocean-teal/40 bg-ocean-teal/5 px-3.5 py-3 text-sm text-foreground">
                Funds left Earn. Finish moving them to your account.
              </p>
            ) : null}
            <ChoiceButton
              title={
                finishEarnMove
                  ? consumerCopy
                    ? "Finish move"
                    : "Finish swap to Base"
                  : "Withdraw from Earn"
              }
              description={
                finishEarnMove
                  ? consumerCopy
                    ? "Funds already left Earn. This finishes the move — it won’t withdraw again."
                    : "USDC is already in your Algorand wallet. Resume the Base swap — don’t redeem again."
                  : canWithdrawFromEarn
                    ? consumerCopy
                      ? "Move funds from Earn back to your account."
                      : "Withdraw supplied funds back to your wallet."
                    : consumerCopy
                      ? "Nothing in Earn yet."
                      : "No supplied balance to withdraw."
              }
              icon={<PiggyBank className="h-5 w-5" />}
              disabled={!canWithdrawFromEarn && !finishEarnMove}
              onClick={onWithdrawFromEarn}
            />
            <ChoiceButton
              title="Cash Out"
              description={
                canCashOut
                  ? baseUsd > 0.01
                    ? consumerCopy
                      ? "Send money from your account. Fee and arrival time are shown on the next screen."
                      : "Cash out USDC. Fee and arrival time are shown on the next screen."
                    : consumerCopy
                      ? "We’ll move it from Earn or the balance available to move, then you can cash out or keep it."
                      : "Move USDC to Base, then cash out or keep it there."
                  : (cashOutEmptyDescription({
                      consumerCopy,
                      baseUsd: 0,
                      earnUsd,
                      algorandUsd,
                    }) ?? "Nothing to cash out.")
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
