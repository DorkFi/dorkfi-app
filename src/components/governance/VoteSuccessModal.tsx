import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { Proposal } from "@/types/governanceTypes";

interface VoteSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  support: boolean;
  votingPower: number;
}

export const VoteSuccessModal = ({
  open,
  onOpenChange,
  proposal,
  support,
  votingPower,
}: VoteSuccessModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="pt-6 px-6">
          <div className="mx-auto mb-4 relative">
            <div className="p-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
              <PartyPopper className="h-8 w-8 text-primary" />
            </div>
            {/* Confetti dots */}
            <div className="absolute -top-2 -left-2 w-2 h-2 rounded-full bg-yellow-400 animate-bounce" />
            <div className="absolute -top-1 -right-3 w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce delay-100" />
            <div className="absolute -bottom-1 -left-3 w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce delay-200" />
            <div className="absolute -bottom-2 -right-2 w-2 h-2 rounded-full bg-green-400 animate-bounce delay-75" />
          </div>
          <DialogTitle className="text-xl">
            Vote Submitted!
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            Your voice has been heard. Thank you for participating in governance!
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Vote Summary */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Proposal</span>
              <span className="text-sm font-medium text-foreground text-right max-w-[200px] truncate">
                {proposal.title}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your Vote</span>
              <span className={`flex items-center gap-1 text-sm font-medium ${support ? 'text-green-500' : 'text-destructive'}`}>
                {support ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {support ? 'For' : 'Against'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Voting Power Used</span>
              <span className="text-sm font-medium text-foreground">
                {votingPower.toLocaleString()} UNIT
              </span>
            </div>
          </div>

          {/* Vote Balance Effect */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Updated Balance
            </div>
            
            {/* Updated Vote Distribution */}
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded-full overflow-hidden flex relative">
                <div 
                  className={`bg-green-500 h-full transition-all ${support ? 'ring-2 ring-green-400 ring-offset-1 animate-pulse' : ''}`}
                  style={{ 
                    width: `${((support ? proposal.votesFor + votingPower : proposal.votesFor) / Math.max((support ? proposal.votesFor + votingPower : proposal.votesFor) + (!support ? proposal.votesAgainst + votingPower : proposal.votesAgainst), 1)) * 100}%` 
                  }}
                />
                <div 
                  className={`bg-destructive h-full transition-all ${!support ? 'ring-2 ring-destructive/80 ring-offset-1 animate-pulse' : ''}`}
                  style={{ 
                    width: `${((!support ? proposal.votesAgainst + votingPower : proposal.votesAgainst) / Math.max((support ? proposal.votesFor + votingPower : proposal.votesFor) + (!support ? proposal.votesAgainst + votingPower : proposal.votesAgainst), 1)) * 100}%` 
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={`flex items-center gap-1.5 font-semibold ${support ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${support ? 'bg-green-500 ring-2 ring-green-400 animate-pulse' : 'bg-green-500'}`} />
                  {support 
                    ? (proposal.votesFor + votingPower).toLocaleString() 
                    : proposal.votesFor.toLocaleString()
                  } For
                  {support && <span className="text-green-400 font-medium ml-1">+{votingPower.toLocaleString()}</span>}
                </span>
                <span className={`flex items-center gap-1.5 font-semibold ${!support ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${!support ? 'bg-destructive ring-2 ring-destructive/80 animate-pulse' : 'bg-destructive'}`} />
                  {!support 
                    ? (proposal.votesAgainst + votingPower).toLocaleString() 
                    : proposal.votesAgainst.toLocaleString()
                  } Against
                  {!support && <span className="text-destructive/80 font-medium ml-1">+{votingPower.toLocaleString()}</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Link Placeholder */}
          <button className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary hover:bg-primary/10 transition-colors">
            <ExternalLink className="h-4 w-4" />
            View Transaction
          </button>
        </div>

        <div className="px-6 pb-6">
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
