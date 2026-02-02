import { useState } from "react";
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
  userVote?: boolean; // undefined = no vote, true = voted for, false = voted against
}

export const VoteSuccessModal = ({
  open,
  onOpenChange,
  proposal,
  support,
  votingPower,
  userVote,
}: VoteSuccessModalProps) => {
  // Calculate updated vote counts, accounting for existing vote if present
  // If user has already voted, subtract their existing vote before adding the new one
  const currentVotesFor = proposal.votesFor - (userVote === true ? votingPower : 0);
  const currentVotesAgainst = proposal.votesAgainst - (userVote === false ? votingPower : 0);

  const updatedVotesFor = support ? currentVotesFor + votingPower : currentVotesFor;
  const updatedVotesAgainst = !support ? currentVotesAgainst + votingPower : currentVotesAgainst;
  const updatedTotal = updatedVotesFor + updatedVotesAgainst;

  const [shareButtonClicked, setShareButtonClicked] = useState(false);

  // Truncate proposal title for tweet (leave room for fixed text ~60 chars)
  const titleForShare = proposal.title.length > 100
    ? `${proposal.title.slice(0, 97)}...`
    : proposal.title;
  const voteLabel = support ? "YES" : "NO";
  const shareText = `Voted ${voteLabel} on "${titleForShare}" in @dork_fi governance 🗳️`;

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
                    width: `${(updatedVotesFor / Math.max(updatedTotal, 1)) * 100}%`
                  }}
                />
                <div
                  className={`bg-destructive h-full transition-all ${!support ? 'ring-2 ring-destructive/80 ring-offset-1 animate-pulse' : ''}`}
                  style={{
                    width: `${(updatedVotesAgainst / Math.max(updatedTotal, 1)) * 100}%`
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className={`flex items-center gap-1.5 font-semibold ${support ? 'text-green-500' : 'text-muted-foreground'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${support ? 'bg-green-500 ring-2 ring-green-400 animate-pulse' : 'bg-green-500'}`} />
                  {updatedVotesFor.toLocaleString()} For
                  {support && <span className="text-green-400 font-medium ml-1">+{votingPower.toLocaleString()}</span>}
                  {userVote === true && !support && <span className="text-muted-foreground font-medium ml-1">-{votingPower.toLocaleString()}</span>}
                </span>
                <span className={`flex items-center gap-1.5 font-semibold ${!support ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${!support ? 'bg-destructive ring-2 ring-destructive/80 animate-pulse' : 'bg-destructive'}`} />
                  {updatedVotesAgainst.toLocaleString()} Against
                  {!support && <span className="text-destructive/80 font-medium ml-1">+{votingPower.toLocaleString()}</span>}
                  {userVote === false && support && <span className="text-muted-foreground font-medium ml-1">-{votingPower.toLocaleString()}</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Link Placeholder */}
          <button className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary hover:bg-primary/10 transition-colors">
            <ExternalLink className="h-4 w-4" />
            View Transaction
          </button>

          {/* Divider and Share on X - hide when share button is clicked */}
          {!shareButtonClicked && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">Share</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  shareText
                )}&url=${encodeURIComponent("https://app.dork.fi")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-black hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black font-semibold text-base text-center transition border border-border"
                onClick={() => setShareButtonClicked(true)}
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                </svg>
                Share on X
              </a>
            </>
          )}
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
