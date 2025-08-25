import React from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import DorkFiButton from "@/components/ui/DorkFiButton";

const NFT_PREVIEW_IMAGE =
  "/lovable-uploads/86303552-f96f-4fee-b61a-7e69d7c17ef0.png";

interface NFTMintCongratsProps {
  onViewNFT: () => void;
  onClose: () => void;
  onDashboard: () => void;
  // Removed onMintAnother prop
}

const NFTMintCongrats: React.FC<NFTMintCongratsProps> = ({
  onViewNFT,
  onClose,
  onDashboard,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 animate-fade-in">
      {/* Confetti & Sparkles */}
      <div className="relative flex flex-col items-center justify-center mb-2">
        <Sparkles className="absolute -top-3 -left-3 text-whale-gold w-7 h-7 animate-bounce" />
        <Sparkles className="absolute -top-3 -right-3 text-highlight-aqua w-7 h-7 animate-bounce animation-delay-300" />
        <CheckCircle2 className="w-16 h-16 text-green-500 drop-shadow-xl bg-white dark:bg-slate-800 rounded-full p-1 border-4 border-whale-gold z-10" />
        <img
          src={NFT_PREVIEW_IMAGE}
          alt="Your DorkFi NFT"
          className="mt-[-30px] w-32 h-32 rounded-xl shadow-md border-4 border-whale-gold mx-auto bg-bubble-white dark:bg-slate-800 object-cover"
        />
      </div>
      <h2 className="text-xl font-bold text-center mb-1">Congratulations!</h2>
      <div className="text-center text-base text-slate-700 dark:text-slate-200 mb-2 font-medium">
        You just minted a <span className="text-whale-gold">free Dork NFT</span>.<br />
        Welcome to the pod!
      </div>
      <div className="flex flex-col gap-2 w-full mt-2">
        <DorkFiButton
          variant="primary"
          className="w-full bg-ocean-teal hover:bg-ocean-teal/90 text-white rounded-xl py-3 text-lg"
          onClick={onViewNFT}
        >
          View NFT
        </DorkFiButton>
        <DorkFiButton
          variant="secondary"
          className="w-full border-ocean-teal text-ocean-teal dark:border-whale-gold dark:text-whale-gold"
          onClick={onDashboard}
        >
          Go to Dashboard
        </DorkFiButton>
        {/* Removed Mint Another NFT button */}
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

export default NFTMintCongrats;
