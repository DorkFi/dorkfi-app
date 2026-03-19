import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Proposal } from "@/types/governanceTypes";
import { PROPOSAL_CATEGORY_DISPLAY_NAMES } from "@/constants/governanceConstants";
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  XCircle, 
  HourglassIcon,
  User,
  Hash,
  Calendar,
  Network,
  Copy,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { getNetworkConfig } from "@/config";
import { getNetworkLogoPath } from "@/utils/tokenImageUtils";
import type { NetworkId } from "@/config";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface ProposalDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
}

const categoryColors: Record<Proposal["category"], string> = {
  "interest-rates": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "collateral-listing": "bg-green-500/10 text-green-600 dark:text-green-400",
  "liquidation-settings": "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "treasury": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "features": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  "governance": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "infrastructure": "bg-teal-500/10 text-teal-600 dark:text-teal-400",
};

const statusConfig = {
  active: { icon: Clock, color: "text-primary", bg: "bg-primary/10" },
  passed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  rejected: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  pending: { icon: HourglassIcon, color: "text-muted-foreground", bg: "bg-muted" },
  executed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-600/10" },
};

export const ProposalDetailsModal = ({
  open,
  onOpenChange,
  proposal,
}: ProposalDetailsModalProps) => {
  const { formatNumber, formatPercent } = useNumberI18n();
  const [copiedId, setCopiedId] = useState(false);
  const [copiedProposer, setCopiedProposer] = useState(false);

  const StatusIcon = statusConfig[proposal.status].icon;
  const votesForPercent = (proposal.votesFor / Math.max(proposal.totalVotes, 1)) * 100;
  const votesAgainstPercent = (proposal.votesAgainst / Math.max(proposal.totalVotes, 1)) * 100;
  const quorumPercent = (proposal.totalVotes / proposal.quorum) * 100;

  const networkIdsList = proposal.networkIds?.length
    ? proposal.networkIds
    : proposal.networkId
      ? [proposal.networkId]
      : [];

  const copyToClipboard = async (text: string, type: "id" | "proposer") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "id") {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else {
        setCopiedProposer(true);
        setTimeout(() => setCopiedProposer(false), 2000);
      }
      toast({
        title: "Copied to clipboard",
        description: `${type === "id" ? "Proposal ID" : "Proposer address"} copied`,
      });
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl sm:text-2xl">{proposal.title}</DialogTitle>
          <DialogDescription className="text-sm sm:text-base mt-2">
            {proposal.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {networkIdsList.length > 0 && (
              <>
                {networkIdsList.length > 1 ? (
                  <Badge variant="secondary" className="gap-1.5">
                    <Network className="h-3.5 w-3.5" />
                    <span>Multichain ({networkIdsList.length} networks)</span>
                  </Badge>
                ) : (
                  networkIdsList.map((nid) => (
                    <Badge key={nid} variant="secondary" className="gap-1.5">
                      <img
                        src={getNetworkLogoPath(nid as NetworkId)}
                        alt=""
                        className="h-3.5 w-3.5 rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/placeholder.svg";
                        }}
                      />
                      <span>{getNetworkConfig(nid as NetworkId).name}</span>
                    </Badge>
                  ))
                )}
              </>
            )}
            <Badge className={categoryColors[proposal.category]}>
              {PROPOSAL_CATEGORY_DISPLAY_NAMES[proposal.category]}
            </Badge>
            <Badge className={statusConfig[proposal.status].bg}>
              <StatusIcon className={`h-3 w-3 mr-1 ${statusConfig[proposal.status].color}`} />
              <span className={statusConfig[proposal.status].color}>
                {proposal.status.toUpperCase()}
              </span>
            </Badge>
          </div>

          {/* Proposal ID */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Hash className="h-4 w-4" />
              <span>Proposal ID</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <code className="text-xs flex-1 break-all font-mono">{proposal.id}</code>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => copyToClipboard(proposal.id, "id")}
              >
                <Copy className={`h-4 w-4 ${copiedId ? "text-green-500" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Proposer */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              <span>Proposer</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <code className="text-xs flex-1 break-all font-mono">{proposal.proposer}</code>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => copyToClipboard(proposal.proposer, "proposer")}
              >
                <Copy className={`h-4 w-4 ${copiedProposer ? "text-green-500" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Timestamps */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              <span>Timeline</span>
            </div>
            <div className="space-y-2 pl-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-xs text-muted-foreground">Start Time</span>
                <div className="flex flex-col sm:items-end">
                  <span className="text-sm font-medium">
                    {format(proposal.startTime, "PPpp")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(proposal.startTime, { addSuffix: true })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-xs text-muted-foreground">End Time</span>
                <div className="flex flex-col sm:items-end">
                  <span className="text-sm font-medium">
                    {format(proposal.endTime, "PPpp")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {proposal.endTime.getTime() > Date.now()
                      ? `Ends ${formatDistanceToNow(proposal.endTime, { addSuffix: true })}`
                      : `Ended ${formatDistanceToNow(proposal.endTime, { addSuffix: true })}`}
                  </span>
                </div>
              </div>
              {proposal.executionTime && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-xs text-muted-foreground">Execution Time</span>
                  <div className="flex flex-col sm:items-end">
                    <span className="text-sm font-medium">
                      {format(proposal.executionTime, "PPpp")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(proposal.executionTime, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Voting Stats */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              <span>Voting Results</span>
            </div>
            <div className="space-y-3 pl-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <TrendingUp className="h-4 w-4" />
                    Votes For
                  </span>
                  <span className="font-medium">
                    {formatNumber(proposal.votesFor, { maximumFractionDigits: 2 })} UNIT
                    <span className="text-muted-foreground ml-2">
                      ({formatPercent(votesForPercent / 100, { maximumFractionDigits: 1 })})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                    <TrendingDown className="h-4 w-4" />
                    Votes Against
                  </span>
                  <span className="font-medium">
                    {formatNumber(proposal.votesAgainst, { maximumFractionDigits: 2 })} UNIT
                    <span className="text-muted-foreground ml-2">
                      ({formatPercent(votesAgainstPercent / 100, { maximumFractionDigits: 1 })})
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Total Votes</span>
                  <span className="font-medium">
                    {formatNumber(proposal.totalVotes, { maximumFractionDigits: 2 })} UNIT
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Quorum</span>
                  <span className="font-medium">
                    {formatNumber(proposal.quorum, { maximumFractionDigits: 2 })} UNIT
                    <span className="text-muted-foreground ml-2">
                      ({formatPercent(quorumPercent / 100, { maximumFractionDigits: 1 })} met)
                    </span>
                  </span>
                </div>
              </div>
              
              {/* Vote Progress Bar */}
              <div className="space-y-1">
                <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                  <div 
                    className="bg-green-500 h-full transition-all" 
                    style={{ width: `${votesForPercent}%` }}
                  />
                  <div 
                    className="bg-red-500 dark:bg-red-400 h-full transition-all" 
                    style={{ width: `${votesAgainstPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Proposal Details (if available) */}
          {proposal.details && Object.keys(proposal.details).length > 1 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Additional Details</div>
              <div className="p-3 bg-muted rounded-md">
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(proposal.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
