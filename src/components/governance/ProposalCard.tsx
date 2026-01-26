import { useState } from "react";
import { Proposal } from "@/types/governanceTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, TrendingUp, TrendingDown, CheckCircle2, XCircle, HourglassIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { H3, Body, Caption } from "@/components/ui/Typography";
import { VoteConfirmationModal } from "./VoteConfirmationModal";
import { SignatureModal } from "./SignatureModal";
import { VoteSuccessModal } from "./VoteSuccessModal";

interface ProposalCardProps {
  proposal: Proposal;
  onVote: (proposalId: string, support: boolean) => Promise<void>;
  userVote?: boolean;
  votingPower?: number;
}

const categoryColors = {
  "interest-rates": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "collateral-listing": "bg-green-500/10 text-green-600 dark:text-green-400",
  "liquidation-settings": "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "treasury": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "features": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

const statusConfig = {
  active: { icon: Clock, color: "text-primary", bg: "bg-primary/10" },
  passed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  rejected: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  pending: { icon: HourglassIcon, color: "text-muted-foreground", bg: "bg-muted" },
  executed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-600/10" },
};

export const ProposalCard = ({ proposal, onVote, userVote, votingPower = 0 }: ProposalCardProps) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingVoteSupport, setPendingVoteSupport] = useState<boolean | null>(null);

  const votesForPercent = (proposal.votesFor / Math.max(proposal.totalVotes, 1)) * 100;
  const votesAgainstPercent = (proposal.votesAgainst / Math.max(proposal.totalVotes, 1)) * 100;
  
  const StatusIcon = statusConfig[proposal.status]?.icon || statusConfig.pending.icon;
  const isActive = proposal.status === "active";
  const canVote = isActive && userVote === undefined;
  const timeLeft = isActive ? formatDistanceToNow(proposal.endTime, { addSuffix: true }) : null;
  
  // Debug logging
  console.log("ProposalCard render", {
    proposalId: proposal.id,
    status: proposal.status,
    isActive,
    userVote,
    canVote,
    votingPower,
  });

  const handleVoteClick = (support: boolean) => {
    console.log("Vote button clicked", { support, proposalId: proposal.id });
    setPendingVoteSupport(support);
    setShowConfirmation(true);
  };

  const handleConfirmVote = () => {
    setShowConfirmation(false);
    setShowSignature(true);
  };

  const handleSign = async () => {
    if (pendingVoteSupport === null) return;
    await onVote(proposal.id, pendingVoteSupport);
  };

  const handleSignSuccess = () => {
    setShowSignature(false);
    setShowSuccess(true);
  };

  const handleSignError = () => {
    // Error is handled in the signature modal
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setPendingVoteSupport(null);
  };

  return (
    <>
      <DorkFiCard className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
            <Badge className={categoryColors[proposal.category]}>
                {proposal.category === "collateral-listing" 
                  ? "MARKET LISTINGS" 
                  : proposal.category.replace("-", " ").toUpperCase()}
              </Badge>
              <Badge className={statusConfig[proposal.status].bg}>
                <StatusIcon className={`h-3 w-3 mr-1 ${statusConfig[proposal.status].color}`} />
                <span className={statusConfig[proposal.status].color}>
                  {proposal.status.toUpperCase()}
                </span>
              </Badge>
            </div>
            <H3>{proposal.title}</H3>
            <Body className="text-sm">{proposal.description}</Body>
          </div>
        </div>

        {/* Voting Stats */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <TrendingUp className="h-4 w-4" />
              For: {votesForPercent.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <TrendingDown className="h-4 w-4" />
              Against: {votesAgainstPercent.toFixed(1)}%
            </span>
          </div>
          
          {/* Vote Progress Bar */}
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden flex">
              <div 
                className="bg-green-500 h-full transition-all" 
                style={{ width: `${votesForPercent}%` }}
              />
              <div 
                className="bg-destructive h-full transition-all" 
                style={{ width: `${votesAgainstPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{proposal.votesFor.toLocaleString()} UNIT</span>
              <span>{proposal.votesAgainst.toLocaleString()} UNIT</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border flex-wrap gap-3">
          {timeLeft && (
            <Caption className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              Ends {timeLeft}
            </Caption>
          )}

          {isActive && (
            <div className="flex gap-2">
              {canVote ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVoteClick(false)}
                    className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                  >
                    Vote Against
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleVoteClick(true)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Vote For
                  </Button>
                </>
              ) : userVote !== undefined ? (
                <Badge variant={userVote ? "default" : "destructive"} className="px-4 py-2">
                  Voted {userVote ? "For" : "Against"}
                </Badge>
              ) : null}
            </div>
          )}
        </div>
      </DorkFiCard>

      {/* Vote Confirmation Modal */}
      {pendingVoteSupport !== null && (
        <VoteConfirmationModal
          open={showConfirmation}
          onOpenChange={(open) => {
            setShowConfirmation(open);
            if (!open) setPendingVoteSupport(null);
          }}
          proposal={proposal}
          support={pendingVoteSupport}
          votingPower={votingPower}
          onConfirm={handleConfirmVote}
        />
      )}

      {/* Signature Modal */}
      {pendingVoteSupport !== null && (
        <SignatureModal
          open={showSignature}
          onOpenChange={(open) => {
            setShowSignature(open);
            if (!open) setPendingVoteSupport(null);
          }}
          action={`vote ${pendingVoteSupport ? 'for' : 'against'} the proposal`}
          onSign={handleSign}
          onSuccess={handleSignSuccess}
          onError={handleSignError}
        />
      )}

      {/* Success Modal */}
      {pendingVoteSupport !== null && (
        <VoteSuccessModal
          open={showSuccess}
          onOpenChange={handleSuccessClose}
          proposal={proposal}
          support={pendingVoteSupport}
          votingPower={votingPower}
        />
      )}
    </>
  );
};
