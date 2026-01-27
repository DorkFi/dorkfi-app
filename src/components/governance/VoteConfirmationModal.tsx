import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Proposal } from "@/types/governanceTypes";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface VoteConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  support: boolean;
  votingPower: number;
  onConfirm: () => void;
}

export const VoteConfirmationModal = ({
  open,
  onOpenChange,
  proposal,
  support,
  votingPower,
  onConfirm,
}: VoteConfirmationModalProps) => {
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset confirming state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsConfirming(false);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    setIsConfirming(true);
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pt-6 px-6">
          <div className="mx-auto mb-4">
            <div className={`p-4 rounded-full ${support ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
              {support ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-destructive" />
              )}
            </div>
          </div>
          <DialogTitle className="text-xl">
            Confirm Your Vote
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            You're about to vote <span className={`font-semibold ${support ? 'text-green-500' : 'text-destructive'}`}>
              {support ? 'FOR' : 'AGAINST'}
            </span> this proposal
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Proposal Summary */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
            <h4 className="font-medium text-foreground line-clamp-2">{proposal.title}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2">{proposal.description}</p>
          </div>

          {/* Voting Power */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm text-muted-foreground">Your Voting Power</span>
            <span className="font-semibold text-foreground">{votingPower.toLocaleString()} UNIT</span>
          </div>

          {/* Vote Balance Effect */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Projected Balance
            </div>
            
            {/* Projected Vote Distribution */}
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded-full overflow-hidden flex relative">
                <div 
                  className={`bg-green-500 h-full transition-all ${support ? 'ring-2 ring-green-400 ring-offset-1' : ''}`}
                  style={{ 
                    width: `${((support ? proposal.votesFor + votingPower : proposal.votesFor) / Math.max((support ? proposal.votesFor + votingPower : proposal.votesFor) + (!support ? proposal.votesAgainst + votingPower : proposal.votesAgainst), 1)) * 100}%` 
                  }}
                />
                <div 
                  className={`bg-destructive h-full transition-all ${!support ? 'ring-2 ring-destructive/80 ring-offset-1' : ''}`}
                  style={{ 
                    width: `${((!support ? proposal.votesAgainst + votingPower : proposal.votesAgainst) / Math.max((support ? proposal.votesFor + votingPower : proposal.votesFor) + (!support ? proposal.votesAgainst + votingPower : proposal.votesAgainst), 1)) * 100}%` 
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={`flex items-center gap-1.5 font-semibold ${support ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${support ? 'bg-green-500 ring-2 ring-green-400' : 'bg-green-500'}`} />
                  {support 
                    ? (proposal.votesFor + votingPower).toLocaleString() 
                    : proposal.votesFor.toLocaleString()
                  } For
                  {support && <span className="text-green-400 font-medium ml-1">+{votingPower.toLocaleString()}</span>}
                </span>
                <span className={`flex items-center gap-1.5 font-semibold ${!support ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${!support ? 'bg-destructive ring-2 ring-destructive/80' : 'bg-destructive'}`} />
                  {!support 
                    ? (proposal.votesAgainst + votingPower).toLocaleString() 
                    : proposal.votesAgainst.toLocaleString()
                  } Against
                  {!support && <span className="text-destructive/80 font-medium ml-1">+{votingPower.toLocaleString()}</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. Your vote will be recorded on-chain and is final.
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`flex-1 ${support ? 'bg-green-600 hover:bg-green-700' : 'bg-destructive hover:bg-destructive/90'}`}
          >
            {isConfirming ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Confirming...
              </span>
            ) : (
              `Vote ${support ? 'For' : 'Against'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
