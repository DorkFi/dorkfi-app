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

interface BatchVoteConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  votes: Array<{ proposal: Proposal; support: boolean }>;
  votingPower: number;
  onConfirm: () => void;
}

export const BatchVoteConfirmationModal = ({
  open,
  onOpenChange,
  votes,
  votingPower,
  onConfirm,
}: BatchVoteConfirmationModalProps) => {
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

  const votesFor = votes.filter((v) => v.support).length;
  const votesAgainst = votes.filter((v) => !v.support).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pt-4 sm:pt-6 px-4 sm:px-6">
          <div className="mx-auto mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-xl">
            Confirm Batch Vote
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            You're about to cast {votes.length} vote{votes.length > 1 ? 's' : ''} on {votes.length} proposal{votes.length > 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 sm:px-6 py-4 space-y-4">
          {/* Vote Summary */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Votes For</span>
              <span className="font-semibold text-green-500">{votesFor}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Votes Against</span>
              <span className="font-semibold text-destructive">{votesAgainst}</span>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Voting Power</span>
                <span className="font-semibold text-foreground">{(votingPower * votes.length).toLocaleString()} UNIT</span>
              </div>
            </div>
          </div>

          {/* Proposals List */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Proposals
            </div>
            {votes.map((vote, index) => (
              <div key={index} className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm text-foreground line-clamp-2 flex-1">
                    {vote.proposal.title}
                  </h4>
                  <div className={`flex items-center gap-1 shrink-0 ${vote.support ? 'text-green-500' : 'text-destructive'}`}>
                    {vote.support ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span className="text-xs font-semibold">
                      {vote.support ? 'FOR' : 'AGAINST'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. All votes will be recorded on-chain in a single transaction and are final.
            </p>
          </div>
        </div>

        <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
            className="flex-1 w-full sm:w-auto min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex-1 w-full sm:w-auto min-h-[44px] bg-primary hover:bg-primary/90"
          >
            {isConfirming ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Confirming...
              </span>
            ) : (
              `Cast ${votes.length} Vote${votes.length > 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
