import { useState } from "react";
import { Proposal } from "@/types/governanceTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, TrendingUp, TrendingDown, CheckCircle2, XCircle, HourglassIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { H3, Body, Caption } from "@/components/ui/Typography";
import { VoteConfirmationModal } from "./VoteConfirmationModal";
import { VoteSuccessModal } from "./VoteSuccessModal";

interface ProposalCardProps {
  proposal: Proposal;
  onVote: (proposalId: string, support: boolean) => Promise<void>;
  userVote?: boolean;
  votingPower?: number;
  isSelected?: boolean;
  selectedVote?: boolean | null; // true = for, false = against, null = not selected
  onSelect?: (proposalId: string, selected: boolean) => void;
  onSelectVote?: (proposalId: string, support: boolean | null) => void;
  batchMode?: boolean;
  isSelectionDisabled?: boolean;
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

export const ProposalCard = ({ 
  proposal, 
  onVote, 
  userVote, 
  votingPower = 0,
  isSelected = false,
  selectedVote = null,
  onSelect,
  onSelectVote,
  batchMode = false,
  isSelectionDisabled = false,
}: ProposalCardProps) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingVoteSupport, setPendingVoteSupport] = useState<boolean | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const votesForPercent = (proposal.votesFor / Math.max(proposal.totalVotes, 1)) * 100;
  const votesAgainstPercent = (proposal.votesAgainst / Math.max(proposal.totalVotes, 1)) * 100;
  const quorumPercent = (proposal.totalVotes / proposal.quorum) * 100;
  
  const StatusIcon = statusConfig[proposal.status].icon;
  const isActive = proposal.status === "active";
  const timeLeft = isActive ? formatDistanceToNow(proposal.endTime, { addSuffix: true }) : null;

  const handleVoteClick = (support: boolean) => {
    setPendingVoteSupport(support);
    setShowConfirmation(true);
  };

  const handleConfirmVote = async () => {
    if (pendingVoteSupport === null) return;
    
    setIsVoting(true);
    try {
      await onVote(proposal.id, pendingVoteSupport);
      // Close confirmation modal and show success modal
      setShowConfirmation(false);
      setShowSuccess(true);
    } catch (error) {
      // Error is handled in the vote function (toast notification)
      // Close confirmation modal on error so user can try again
      setShowConfirmation(false);
      setPendingVoteSupport(null);
    } finally {
      setIsVoting(false);
    }
  };

  const handleConfirmationClose = (open: boolean) => {
    if (!open) {
      // Reset state when confirmation modal is cancelled
      setPendingVoteSupport(null);
      setShowConfirmation(false);
    } else {
      setShowConfirmation(open);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setPendingVoteSupport(null);
  };

  const handleSelectChange = (checked: boolean) => {
    onSelect?.(proposal.id, checked);
    if (!checked) {
      onSelectVote?.(proposal.id, null);
    }
  };

  const handleSelectVoteClick = (support: boolean) => {
    if (isSelected) {
      onSelectVote?.(proposal.id, support);
    }
  };

  return (
    <>
      <DorkFiCard className={`p-4 sm:p-6 space-y-3 sm:space-y-4 ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {batchMode && isActive && userVote === undefined && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={handleSelectChange}
                  disabled={isSelectionDisabled}
                  className="mr-1 shrink-0 h-5 w-5 sm:h-4 sm:w-4"
                />
              )}
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
            <H3 className="text-base sm:text-lg leading-tight">{proposal.title}</H3>
            <Body className="text-xs sm:text-sm line-clamp-2 sm:line-clamp-3">{proposal.description}</Body>
          </div>
        </div>

        {/* Voting Stats */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <TrendingUp className="h-4 w-4" />
              For: {votesForPercent.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
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
                className="bg-red-500 dark:bg-red-400 h-full transition-all" 
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-border gap-3">
          {timeLeft && (
            <Caption className="flex items-center gap-1 text-muted-foreground text-xs sm:text-sm">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              Ends {timeLeft}
            </Caption>
          )}

          {isActive && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              {userVote === undefined ? (
                batchMode && isSelected ? (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <span className="text-sm text-muted-foreground sm:hidden">Vote:</span>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant={selectedVote === false ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSelectVoteClick(false)}
                        className={`flex-1 sm:flex-initial min-h-[44px] ${
                          selectedVote === false 
                            ? "bg-red-500 hover:bg-red-600 text-white" 
                            : "border-red-500 text-red-500 hover:bg-red-500/10 dark:border-red-400 dark:text-red-400"
                        }`}
                      >
                        Against
                      </Button>
                      <Button
                        variant={selectedVote === true ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSelectVoteClick(true)}
                        className={`flex-1 sm:flex-initial min-h-[44px] ${
                          selectedVote === true 
                            ? "bg-green-600 hover:bg-green-700 text-white" 
                            : "border-green-600 text-green-600 hover:bg-green-600/10"
                        }`}
                      >
                        For
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVoteClick(false)}
                      className="flex-1 sm:flex-initial min-h-[44px] border-red-500 text-red-500 hover:bg-transparent hover:text-red-500 dark:border-red-400 dark:text-red-400 dark:hover:text-red-400"
                    >
                      Vote Against
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleVoteClick(true)}
                      className="flex-1 sm:flex-initial min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                    >
                      Vote For
                    </Button>
                  </div>
                )
              ) : (
                <Badge variant={userVote ? "default" : "destructive"} className="px-4 py-2 w-full sm:w-auto text-center sm:text-left min-h-[44px] flex items-center justify-center sm:justify-start">
                  Voted {userVote ? "For" : "Against"}
                </Badge>
              )}
            </div>
          )}
        </div>
      </DorkFiCard>

      {/* Vote Confirmation Modal */}
      {pendingVoteSupport !== null && (
        <VoteConfirmationModal
          open={showConfirmation}
          onOpenChange={handleConfirmationClose}
          proposal={proposal}
          support={pendingVoteSupport}
          votingPower={votingPower}
          onConfirm={handleConfirmVote}
          isVoting={isVoting}
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
