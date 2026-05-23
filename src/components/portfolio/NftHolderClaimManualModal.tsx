import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DORK_DRIP_CONFIG, DORK_V2_DRIP_CONFIG } from "@/config/nftDrips";
import { NFT_DRIP_CLAIMS_PER_GROUP } from "@/services/nftDripClaimService";
import { UnitNftDripTool } from "@/components/tools/UnitNftDripTool";
import { cn } from "@/lib/utils";

type DripTab = "dork" | "dork-v2";

type NftHolderClaimManualModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Portfolio / claim beneficiary (58-char AVM). */
  beneficiaryAddress: string;
};

export function NftHolderClaimManualModal({
  open,
  onOpenChange,
  beneficiaryAddress,
}: NftHolderClaimManualModalProps) {
  const [tab, setTab] = useState<DripTab>("dork");

  useEffect(() => {
    if (!open) setTab("dork");
  }, [open]);

  const config = tab === "dork" ? DORK_DRIP_CONFIG : DORK_V2_DRIP_CONFIG;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,920px)] w-full max-w-[min(100vw-1.5rem,44rem)] overflow-y-auto overflow-x-hidden border-slate-800 bg-slate-950 p-0 pt-12 text-slate-100 shadow-2xl sm:max-w-4xl sm:pt-14 z-[110]">
        <div className="border-b border-slate-800">
          <div className="relative w-full overflow-hidden bg-slate-950">
            <img
              src="/nft-reward-agent-hero.png"
              alt="Manual UNIT drip claim — review NFT rewards and sign with your wallet"
              className="block h-auto w-full max-w-none align-middle"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>

        <div className="space-y-3 px-6 py-5 sm:px-8 sm:py-6">
          <DialogHeader className="space-y-2 pr-6 text-left sm:pr-8">
            <DialogTitle className="text-left text-lg font-semibold tracking-tight text-white">
              Manual claim{" "}
              <span className="text-emerald-400">on-chain</span>
            </DialogTitle>
            <DialogDescription className="text-left text-xs leading-relaxed text-slate-400">
              Load your NFTs and claim up to {NFT_DRIP_CLAIMS_PER_GROUP} rewards at a time.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={tab === "dork" ? "default" : "outline"}
              className={cn(
                tab === "dork" && "bg-emerald-800 hover:bg-emerald-700",
                tab !== "dork" && "border-slate-600 text-slate-200"
              )}
              onClick={() => setTab("dork")}
            >
              Dorks
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "dork-v2" ? "default" : "outline"}
              className={cn(
                tab === "dork-v2" && "bg-emerald-800 hover:bg-emerald-700",
                tab !== "dork-v2" && "border-slate-600 text-slate-200"
              )}
              onClick={() => setTab("dork-v2")}
            >
              Dorks V2
            </Button>
          </div>

          <UnitNftDripTool
            key={tab}
            config={config}
            requiredAddress={beneficiaryAddress.trim()}
            compact
          />
        </div>

        <DialogFooter className="border-t border-slate-800/80 px-6 py-4 sm:justify-center sm:px-8">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-slate-400 hover:bg-slate-900 hover:text-slate-100"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
