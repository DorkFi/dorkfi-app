import { useState, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  getGovernanceProposalsPage,
  governanceApiBase,
  proposalsNextPageCursor,
} from "@/lib/governanceApi";
import { apiRecordToProposal } from "@/utils/apiProposalToProposal";
import { H2, Body, Caption } from "@/components/ui/Typography";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  HourglassIcon,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DorkFiCard from "@/components/ui/DorkFiCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Proposal, ProposalCategory, ProposalStatus } from "@/types/governanceTypes";
import {
  GOVERNANCE_PASS_THRESHOLD_DISPLAY,
  GOVERNANCE_PASS_THRESHOLD_YES_FRACTION,
  PROPOSAL_CATEGORY_DISPLAY_NAMES,
} from "@/constants/governanceConstants";
import { ProposalDetailsModal } from "@/components/governance/ProposalDetailsModal";
import { GovernanceProposalCountCards } from "@/components/governance/GovernanceProposalCountCards";
import { formatDistanceToNow } from "date-fns";
import { useNumberI18n } from "@/contexts/LocaleSettingsContext";
import { Input } from "@/components/ui/input";
import { proposalMatchesSearch } from "@/utils/proposalSearchMatch";

const PAGE_SIZE = 20;

const categoryColors: Record<ProposalCategory, string> = {
  "interest-rates": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "collateral-listing": "bg-green-500/10 text-green-600 dark:text-green-400",
  "liquidation-settings": "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "treasury": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  "features": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  "governance": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "infrastructure": "bg-teal-500/10 text-teal-600 dark:text-teal-400",
};

/** Matches `ProposalCard` status chips for a consistent Live / Archives look. */
const archiveStatusConfig: Record<
  ProposalStatus,
  { Icon: typeof Clock; color: string; bg: string }
> = {
  active: { Icon: Clock, color: "text-primary", bg: "bg-primary/10" },
  passed: {
    Icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  rejected: {
    Icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  pending: {
    Icon: HourglassIcon,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
  executed: {
    Icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-600/10",
  },
};

/** Optional compact suffix for Archives status chip (count-only rows only). */
function archiveStatusThresholdSuffix(proposal: Proposal): string | null {
  const { status, endTime, votesFor, votesAgainst, usesVotingPowerTally, totalVotes } =
    proposal;
  const ended = endTime.getTime() > 0 && endTime.getTime() < Date.now();
  const powerTally = usesVotingPowerTally === true && totalVotes > 0;
  const hadCountVotes = votesFor + votesAgainst > 0;

  if (status === "passed" || status === "executed") {
    if (powerTally) return null;
    return ` · ≥${GOVERNANCE_PASS_THRESHOLD_DISPLAY}`;
  }
  if (status === "rejected" && ended && !powerTally && hadCountVotes) {
    return ` · <${GOVERNANCE_PASS_THRESHOLD_DISPLAY} yes`;
  }
  return null;
}

function archiveStatusBadgeTitle(proposal: Proposal): string {
  const powerTally = proposal.usesVotingPowerTally === true;
  const base = powerTally
    ? `Passing requires at least ${GOVERNANCE_PASS_THRESHOLD_DISPLAY} yes of total voting power cast once voting has ended (same rule as Live).`
    : `Passing requires at least ${GOVERNANCE_PASS_THRESHOLD_DISPLAY} yes of votes cast once voting has ended when the node does not expose a power tally (same rule as Live).`;
  if (proposal.status === "active") {
    return `${base} This proposal is still open for votes.`;
  }
  return base;
}

function matchesStatusFilter(
  proposal: Proposal,
  filter: ProposalStatus | "all"
): boolean {
  if (filter === "all") return true;
  if (filter === "passed") {
    return proposal.status === "passed" || proposal.status === "executed";
  }
  return proposal.status === filter;
}

function ArchiveQuorumCell({ proposal }: { proposal: Proposal }) {
  const { formatPercent } = useNumberI18n();
  const usePower = proposal.usesVotingPowerTally === true;
  const yesPower = proposal.votesFor;
  const totalPower =
    usePower && proposal.totalVotes > 0 ? proposal.totalVotes : 0;
  const countTotal = proposal.votesFor + proposal.votesAgainst;

  const totalForBar =
    usePower && totalPower > 0
      ? totalPower
      : Math.max(countTotal, proposal.totalVotes, 0);
  const againstForBar =
    usePower && totalPower > 0
      ? Math.max(0, totalPower - yesPower)
      : proposal.votesAgainst;

  const norm = Math.max(proposal.quorum, totalForBar, 1e-9);
  const forW = (yesPower / norm) * 100;
  const againstW = (againstForBar / norm) * 100;
  const quorumLine = Math.min(100, (proposal.quorum / norm) * 100);
  const passLinePct = GOVERNANCE_PASS_THRESHOLD_YES_FRACTION * 100;

  const denomForShare =
    usePower && proposal.totalVotes > 0
      ? proposal.totalVotes
      : countTotal > 0
        ? countTotal
        : proposal.totalVotes > 0
          ? proposal.totalVotes
          : 0;
  const yesSharePct =
    denomForShare > 0 ? (yesPower / denomForShare) * 100 : 0;

  if (totalForBar <= 0 && proposal.quorum <= 0) {
    return <Caption className="text-muted-foreground">—</Caption>;
  }

  const passLineTitle = usePower
    ? "Pass threshold (yes ÷ total voting power cast)"
    : "Pass threshold (yes share of votes cast)";

  return (
    <div className="space-y-1.5 min-w-[120px] max-w-[200px]">
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div className="absolute inset-y-0 left-0 flex w-full">
          <div
            className="h-full bg-green-500 dark:bg-green-500/90 transition-all"
            style={{ width: `${Math.min(forW, 100)}%` }}
          />
          <div
            className="h-full bg-red-500/85 dark:bg-red-400/80 transition-all"
            style={{ width: `${Math.min(againstW, 100 - forW)}%` }}
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-400 z-[11] rounded-full shadow-sm pointer-events-none"
          style={{ left: `${passLinePct}%`, transform: "translateX(-50%)" }}
          title={passLineTitle}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10 rounded-full shadow-sm pointer-events-none"
          style={{ left: `${quorumLine}%`, transform: "translateX(-50%)" }}
          title="Quorum (participation) reference"
        />
      </div>
      <Caption className="text-muted-foreground tabular-nums">
        {denomForShare > 0
          ? `${formatPercent(yesSharePct / 100, { maximumFractionDigits: 1 })} yes`
          : "No votes yet"}
      </Caption>
    </div>
  );
}

type GovernanceApiProposalsPanelProps = {
  /** When false, queries do not run (e.g. inactive tab). */
  queriesEnabled: boolean;
};

export function GovernanceApiProposalsPanel({
  queriesEnabled,
}: GovernanceApiProposalsPanelProps) {
  const base = governanceApiBase();
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);

  const proposalsQuery = useInfiniteQuery({
    queryKey: ["governance-node-proposals", base],
    enabled: queriesEnabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const page = await getGovernanceProposalsPage({
        limit: PAGE_SIZE,
        cursor: pageParam,
      });
      const proposals = page.items.map((item) =>
        apiRecordToProposal(
          typeof item === "object" && item !== null
            ? (item as Record<string, unknown>)
            : {}
        )
      );
      return {
        body: page.body,
        proposals,
        requestCursor: page.requestCursor,
      };
    },
    getNextPageParam: (lastPage) =>
      proposalsNextPageCursor(lastPage.body, lastPage.requestCursor),
  });

  const flatProposals = useMemo(
    () => proposalsQuery.data?.pages.flatMap((p) => p.proposals) ?? [],
    [proposalsQuery.data]
  );

  const firstBody = proposalsQuery.data?.pages[0]?.body;
  const apiActive =
    typeof firstBody?.activeCount === "number"
      ? firstBody.activeCount
      : undefined;
  const apiClosed =
    typeof firstBody?.closedCount === "number"
      ? firstBody.closedCount
      : undefined;

  const loadedActive = useMemo(
    () => flatProposals.filter((p) => p.status === "active").length,
    [flatProposals]
  );
  const loadedClosed = useMemo(
    () => flatProposals.filter((p) => p.status !== "active").length,
    [flatProposals]
  );

  const displayActive = apiActive ?? loadedActive;
  const displayClosed = apiClosed ?? loadedClosed;

  const proposalsMatchingStatus = useMemo(
    () => flatProposals.filter((p) => matchesStatusFilter(p, statusFilter)),
    [flatProposals, statusFilter]
  );

  const filteredProposals = useMemo(
    () =>
      proposalsMatchingStatus.filter((p) =>
        proposalMatchesSearch(p, searchQuery)
      ),
    [proposalsMatchingStatus, searchQuery]
  );

  const statuses: (ProposalStatus | "all")[] = [
    "all",
    "active",
    "passed",
    "rejected",
  ];

  const handleRefresh = () => {
    void proposalsQuery.refetch();
  };

  const dateLabel = (p: Proposal) => {
    const ref =
      p.status === "pending" || p.status === "active"
        ? p.startTime
        : p.endTime;
    if (!ref || ref.getTime() <= 0) return "—";
    try {
      return formatDistanceToNow(ref, { addSuffix: true });
    } catch {
      return "—";
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <GovernanceProposalCountCards
        activeCount={proposalsQuery.isLoading ? null : displayActive}
        closedCount={proposalsQuery.isLoading ? null : displayClosed}
      />

      <DorkFiCard className="p-0 overflow-hidden" hoverable={false}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 pt-4 pb-2 sm:px-5 border-b border-border/60">
          <H2 className="text-lg sm:text-xl m-0">All proposals</H2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 w-full sm:w-auto"
            onClick={handleRefresh}
            disabled={
              proposalsQuery.isFetching || proposalsQuery.isFetchingNextPage
            }
          >
            <RefreshCw
              className={`h-4 w-4 ${proposalsQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="px-4 sm:px-5 pb-3 space-y-3">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ProposalStatus | "all")}
          >
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto min-h-9 p-1 gap-1">
              {statuses.map((s) => (
                <TabsTrigger
                  key={s}
                  value={s}
                  className="text-xs sm:text-sm px-2 py-2"
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, description, ID, proposer…"
              className="pl-9"
              aria-label="Search proposals"
            />
          </div>
        </div>

        <Caption className="px-4 sm:px-5 pb-2 block text-muted-foreground">
          All chains · read-only · vote on Live
        </Caption>

        {proposalsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : proposalsQuery.isError ? (
          <div className="text-center py-12 px-4 space-y-2">
            <p className="text-destructive font-medium">Could not load proposals</p>
            <Body className="text-sm text-muted-foreground">
              {proposalsQuery.error instanceof Error
                ? proposalsQuery.error.message
                : "Unknown error"}
            </Body>
          </div>
        ) : flatProposals.length === 0 ? (
          <div className="px-4 pb-8">
            <p className="text-muted-foreground text-center py-8">
              No proposals returned.
            </p>
          </div>
        ) : proposalsMatchingStatus.length === 0 ? (
          <div className="px-4 pb-8">
            <p className="text-muted-foreground text-center py-8">
              No proposals match this filter.
            </p>
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="px-4 pb-8">
            <p className="text-muted-foreground text-center py-8">
              No proposals match your search. Try different keywords or clear the search field.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/60">
                <TableHead className="min-w-[140px] sm:min-w-[200px]">
                  Title
                </TableHead>
                <TableHead className="w-[100px] sm:w-[120px]">Status</TableHead>
                <TableHead className="hidden md:table-cell w-[180px]">
                  Votes / quorum
                </TableHead>
                <TableHead className="w-[100px] sm:w-[120px] text-right">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProposals.map((proposal) => {
                const st = archiveStatusConfig[proposal.status];
                const StatusIcon = st.Icon;
                const thresholdSuffix = archiveStatusThresholdSuffix(proposal);
                return (
                  <TableRow
                    key={`archive-${proposal.id}`}
                    className="cursor-pointer border-border/50"
                    onClick={() => setDetailProposal(proposal)}
                  >
                    <TableCell className="align-top py-3">
                      <div className="space-y-2">
                        <div className="font-semibold text-sm sm:text-base leading-snug line-clamp-2">
                          {proposal.title}
                        </div>
                        <Badge className={categoryColors[proposal.category]}>
                          {PROPOSAL_CATEGORY_DISPLAY_NAMES[proposal.category]}
                        </Badge>
                        <div className="md:hidden pt-1">
                          <ArchiveQuorumCell proposal={proposal} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-3">
                      <Badge
                        title={archiveStatusBadgeTitle(proposal)}
                        className={`${st.bg} border-transparent inline-flex max-w-[11rem] flex-wrap items-center gap-x-1 gap-y-0.5 shrink-0 px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold tracking-wide`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <StatusIcon
                            className={`h-3.5 w-3.5 shrink-0 ${st.color}`}
                          />
                          <span className={st.color}>
                            {proposal.status.toUpperCase()}
                          </span>
                        </span>
                        {thresholdSuffix ? (
                          <span
                            className={`font-medium normal-case tracking-tight ${proposal.status === "rejected" ? "text-muted-foreground" : st.color} opacity-90`}
                          >
                            {thresholdSuffix}
                          </span>
                        ) : null}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell align-middle py-3">
                      <ArchiveQuorumCell proposal={proposal} />
                    </TableCell>
                    <TableCell className="align-top py-3 text-right text-muted-foreground text-xs sm:text-sm tabular-nums whitespace-nowrap">
                      {dateLabel(proposal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {proposalsQuery.hasNextPage && (
          <div className="flex justify-center p-4 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              disabled={proposalsQuery.isFetchingNextPage}
              onClick={() => proposalsQuery.fetchNextPage()}
            >
              {proposalsQuery.isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading…
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </DorkFiCard>

      {detailProposal ? (
        <ProposalDetailsModal
          open
          onOpenChange={(open) => {
            if (!open) setDetailProposal(null);
          }}
          proposal={detailProposal}
        />
      ) : null}
    </div>
  );
}
