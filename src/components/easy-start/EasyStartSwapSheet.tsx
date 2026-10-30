import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SwapCard, {
  type SwapSuccessState,
} from "@/components/easy-swap/SwapCard";
import SupplyBorrowCongrats from "@/components/SupplyBorrowCongrats";
import {
  EASY_START_FUNDING_DIALOG_CLASS,
  FundingSheetHeader,
} from "@/components/easy-start/EasyStartFundingUi";
import { usePrivyEasyStart } from "@/contexts/privyEasyStartContext";
import { useConsumerCopy } from "@/contexts/ProductFlavorContext";
import { getExplorerTransactionUrl } from "@/utils/explorerLinks";

interface EasyStartSwapSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Connected Algorand wallet. Omit to swap the Easy Start xChain account. */
  walletAddress?: string | null;
}

/**
 * Algorand asset swap, quoted and executed through Haystack.
 * Easy Start signs with the Privy xChain account. A connected wallet signs itself.
 */
export function EasyStartSwapSheet({
  open,
  onOpenChange,
  walletAddress = null,
}: EasyStartSwapSheetProps) {
  const { algorandAddress, algorandAddressLoading } = usePrivyEasyStart();
  const consumerCopy = useConsumerCopy();
  const usingWallet = Boolean(walletAddress);
  const address = usingWallet ? walletAddress : algorandAddress;
  const loading = usingWallet ? false : algorandAddressLoading;
  const [signing, setSigning] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [success, setSuccess] = useState<SwapSuccessState | null>(null);
  const [formKey, setFormKey] = useState(0);
  const signingRef = useRef(false);
  const awaitingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      signingRef.current = false;
      awaitingRef.current = false;
      setSigning(false);
      setAwaitingConfirmation(false);
      setSuccess(null);
    }
  }, [open]);

  const setSigningState = (next: boolean) => {
    signingRef.current = next;
    setSigning(next);
  };

  const handleAwaitingConfirmation = () => {
    awaitingRef.current = true;
    setAwaitingConfirmation(true);
  };

  const handleSwapFailed = () => {
    awaitingRef.current = false;
    setAwaitingConfirmation(false);
  };

  const handleSwapped = (result: SwapSuccessState) => {
    signingRef.current = false;
    awaitingRef.current = false;
    setSigning(false);
    setAwaitingConfirmation(false);
    setSuccess(result);
  };

  const handleMakeAnother = () => {
    awaitingRef.current = false;
    setAwaitingConfirmation(false);
    setSuccess(null);
    setFormKey((k) => k + 1);
  };

  const blockDismiss = !success && (signing || awaitingConfirmation);

  return (
    <Dialog
      open={open}
      modal={!signing}
      onOpenChange={(next) => {
        if (!next && !success && (signingRef.current || awaitingRef.current)) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={EASY_START_FUNDING_DIALOG_CLASS}
        overlayClassName={signing ? "pointer-events-none !z-30" : undefined}
        layerClassName={signing ? "pointer-events-none !z-30" : undefined}
        onInteractOutside={(event) => {
          if (blockDismiss) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (blockDismiss) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (blockDismiss) event.preventDefault();
        }}
      >
        {success ? (
          <div className="px-5 pb-6 pt-10 sm:px-7">
            <DialogHeader className="sr-only">
              <DialogTitle>Swap confirmed</DialogTitle>
              <DialogDescription>
                Your swap completed successfully.
              </DialogDescription>
            </DialogHeader>
            <SupplyBorrowCongrats
              transactionType="swap"
              asset={success.toSymbol}
              assetIcon={success.toIcon}
              amount={success.amountOut}
              swapFrom={{
                symbol: success.fromSymbol,
                icon: success.fromIcon,
                amount: success.amountIn,
              }}
              onViewTransaction={() => {
                if (!success.txId) return;
                window.open(
                  getExplorerTransactionUrl("algorand-mainnet", success.txId),
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
              onGoToPortfolio={() => {
                window.location.href = "/portfolio";
              }}
              onMakeAnother={handleMakeAnother}
              onClose={() => onOpenChange(false)}
              viewTransactionDisabled={!success.txId}
            />
          </div>
        ) : (
          <>
            {awaitingConfirmation ? (
              <>
                <FundingSheetHeader
                  title={consumerCopy ? "Confirming" : "Confirming swap"}
                  subtitle={
                    consumerCopy
                      ? "Waiting for the network. Keep this open."
                      : "Waiting for Algorand confirmation. Keep this open."
                  }
                />
                <div className="px-6 pb-10 pt-4 flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-ocean-teal" />
                  <p className="text-sm font-medium">
                    {consumerCopy ? "Confirming…" : "Waiting for confirmation…"}
                  </p>
                </div>
              </>
            ) : (
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
            )}
            <div className={awaitingConfirmation ? "hidden" : "px-6 pb-6"}>
              <SwapCard
                key={formKey}
                embedded={!usingWallet}
                networkId="algorand-mainnet"
                accountAddress={address}
                accountLoading={loading}
                accountError={
                  usingWallet || loading
                    ? null
                    : "Algorand account isn’t ready yet."
                }
                onSigningChange={setSigningState}
                onAwaitingConfirmation={handleAwaitingConfirmation}
                onSwapFailed={handleSwapFailed}
                onSwapped={handleSwapped}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
