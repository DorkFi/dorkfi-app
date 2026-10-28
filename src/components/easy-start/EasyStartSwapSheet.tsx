import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import SwapCard from "@/components/easy-swap/SwapCard";
import {
  EASY_START_FUNDING_DIALOG_CLASS,
  FundingSheetHeader,
} from "@/components/easy-start/EasyStartFundingUi";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";

interface EasyStartSwapSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Algorand asset swap for the Easy Start xChain account, quoted and executed
 * through Haystack. The Privy embedded EVM wallet signs the group.
 */
export function EasyStartSwapSheet({
  open,
  onOpenChange,
}: EasyStartSwapSheetProps) {
  const { algorandAddress, algorandAddressLoading } = usePrivyEasyStart();
  const [signing, setSigning] = useState(false);
  const signingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      signingRef.current = false;
      setSigning(false);
    }
  }, [open]);

  const setSigningState = (next: boolean) => {
    signingRef.current = next;
    setSigning(next);
  };

  return (
    <Dialog
      open={open}
      modal={!signing}
      onOpenChange={(next) => {
        if (!next && signingRef.current) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={EASY_START_FUNDING_DIALOG_CLASS}
        overlayClassName={signing ? "pointer-events-none !z-30" : undefined}
        layerClassName={signing ? "pointer-events-none !z-30" : undefined}
        onInteractOutside={(event) => {
          if (signingRef.current) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (signingRef.current) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (signingRef.current) event.preventDefault();
        }}
      >
        <FundingSheetHeader
          title="Swap"
          subtitle="Exchange assets in your Algorand account."
          icon={
            <span
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ocean-teal/15 text-ocean-teal"
              aria-hidden
            >
              <ArrowLeftRight className="h-7 w-7" />
            </span>
          }
        />
        <div className="px-6 pb-6">
          <SwapCard
            embedded
            networkId="algorand-mainnet"
            accountAddress={algorandAddress}
            accountLoading={algorandAddressLoading}
            accountError={
              algorandAddressLoading
                ? null
                : "Algorand account isn’t ready yet."
            }
            onSigningChange={setSigningState}
            onSwapped={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
