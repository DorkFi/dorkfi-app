import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import DorkFiButton from "@/components/ui/DorkFiButton";
import NFTMintCongrats from "./NFTMintCongrats";

import { X } from "lucide-react";

interface NFTMintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mintedSupply?: number;
  walletConnected?: boolean;
  onMint?: () => void;
  onLearnMore?: () => void;
}

const NFT_PREVIEW_IMAGE =
  "/lovable-uploads/86303552-f96f-4fee-b61a-7e69d7c17ef0.png";

export default function NFTMintModal({
  open,
  onOpenChange,
  mintedSupply = 1274,
  walletConnected = false,
  onMint,
  onLearnMore,
}: NFTMintModalProps) {
  const [step, setStep] = React.useState<"mint" | "congrats">("mint");

  // Reset step when reopened
  React.useEffect(() => {
    if (open) setStep("mint");
  }, [open]);

  // Mint handler now changes step instead of redirecting
  const handleMint = () => {
    if (!walletConnected) {
      if (onMint) onMint();
    } else {
      setTimeout(() => {
        setStep("congrats");
      }, 650);
    }
  };

  // Go to dashboard
  const handleGoToDashboard = () => {
    onOpenChange(false);
    window.location.href = "/";
  };

  // View NFT handler
  const handleViewNFT = () => {
    window.open("https://testnets.opensea.io/", "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-full max-w-[500px] min-h-[300px]
          px-4 sm:px-8 py-6 sm:py-8
          rounded-xl shadow-xl
          bg-white dark:bg-slate-900
          text-slate-900 dark:text-white
          border border-gray-200/50 dark:border-ocean-teal/20
          card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all
          animate-scale-in animate-fade-in
        "
      >
        {step === "congrats" ? (
          <NFTMintCongrats
            onViewNFT={handleViewNFT}
            onClose={() => onOpenChange(false)}
            onDashboard={handleGoToDashboard}
          />
        ) : (
          <>
            <DialogHeader className="space-y-2">
              <DialogTitle>
                Claim Your Free Dork NFT
              </DialogTitle>
              <DialogDescription className="text-center text-base font-medium text-slate-500 dark:text-slate-200">
                Mint a free NFT to join the pod, access features, or just flex your fin.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center gap-4 mt-4">
              <div className="w-full flex justify-center">
                <img
                  src={NFT_PREVIEW_IMAGE}
                  alt="DorkFi Whale NFT Preview"
                  className="
                    w-32 h-32 sm:w-40 sm:h-40
                    rounded-xl shadow-md border-4 
                    border-whale-gold object-cover mx-auto
                    bg-bubble-white dark:bg-slate-800
                  "
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="text-center text-sm mt-2 px-2 text-slate-700 dark:text-slate-300">
                This NFT represents your DorkFi identity.
                <span className="block">Free to mint. Yours to keep.</span>
                <span className="block font-medium text-whale-gold dark:text-whale-gold mt-1">Some whales will get exclusive perks soon.</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Minted so far:</span>
                <span className="font-semibold text-base text-whale-gold dark:text-whale-gold">{mintedSupply.toLocaleString()}</span>
              </div>
              {!walletConnected ? (
                <div className="w-full mt-4">
                  <DorkFiButton
                    variant="primary"
                    className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white text-lg rounded-xl py-3 transition-all mt-4"
                    onClick={handleMint}
                  >
                    Connect Wallet to Mint
                  </DorkFiButton>
                </div>
              ) : (
                <div className="w-full mt-4 flex flex-col gap-2">
                  <DorkFiButton
                    variant="primary"
                    className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white text-lg rounded-xl py-3 transition-all mt-4"
                    onClick={handleMint}
                  >
                    Mint Now
                  </DorkFiButton>
                  <DorkFiButton
                    variant="secondary"
                    className="w-full border-ocean-teal text-ocean-teal dark:border-whale-gold dark:text-whale-gold mt-0"
                    onClick={onLearnMore}
                  >
                    Learn More
                  </DorkFiButton>
                </div>
              )}
              <button
                type="button"
                className="text-xs underline text-slate-500 dark:text-slate-300 hover:text-slate-800 hover:dark:text-white mt-3 transition-colors"
                onClick={() => onOpenChange(false)}
              >
                Not now
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
