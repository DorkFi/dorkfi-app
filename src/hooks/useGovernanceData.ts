import { useState, useEffect, useMemo } from "react";
import { Proposal, VotingStats } from "@/types/governanceTypes";
import { getEvents, decodeProposalCreatedEvent, getProposal, getVoter, Voter, castVote, castBatchVote, getVote } from "@/services/governanceService";
import { convertServiceProposalToUI } from "@/utils/governanceUtils";
import { isProposalBlacklisted } from "@/constants/governanceConstants";
import { useWallet } from "@txnlab/use-wallet-react";
import algorandService, { AlgorandNetwork } from "@/services/algorandService";
import { getNetworkConfig, getAlgorandNetworkFromNetworkId, getNetworksWithGovernance, type NetworkId } from "@/config";
import algosdk, { waitForConfirmation } from "algosdk";
import { toast } from "@/hooks/use-toast";

function fetchErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Failed to load governance data";
}

/**
 * Calculate voting stats from proposals
 */
const calculateStatsFromProposals = (
  proposals: Proposal[],
  userVotingPower: number = 0
): VotingStats => {
  const activeProposals = proposals.filter((p) => p.status === "active").length;
  const totalProposals = proposals.length;
  
  // Calculate total voting power from all proposals (use max quorum as proxy for total supply)
  const maxQuorum = proposals.length > 0
    ? Math.max(...proposals.map((p) => p.quorum))
    : 0;
  const totalUnitSupply = maxQuorum > 0 ? maxQuorum * 2 : 0;

  // Calculate participation rate from average of proposals
  const avgParticipation = proposals.length > 0
    ? proposals.reduce((sum, p) => {
        const participation = p.quorum > 0 ? (p.totalVotes / p.quorum) * 100 : 0;
        return sum + participation;
      }, 0) / proposals.length
    : 0;

  return {
    totalUnitSupply,
    yourVotingPower: userVotingPower,
    activeProposals,
    totalProposals,
    participationRate: avgParticipation,
  };
};

const VOTE_KEY_SEP = "::";
/** Key for userVotes map. For merged (multi-network) proposals pass networkId to look up vote on a specific network. */
export const getVoteKey = (
  proposal: { id: string; networkId?: string; networkIds?: string[] },
  networkId?: string
): string => {
  const net = networkId ?? proposal.networkId;
  return net ? `${net}${VOTE_KEY_SEP}${proposal.id}` : proposal.id;
};

/**
 * Group raw proposals (one per network) by proposalId and aggregate voting data.
 * Returns one card per shared proposalId with summed votes and networkIds list.
 * Proposals without networkId are passed through as single-item groups.
 */
function mergeProposalsById(raw: Proposal[]): Proposal[] {
  const byId = new Map<string, Proposal[]>();
  for (const p of raw) {
    const list = byId.get(p.id) ?? [];
    list.push(p);
    byId.set(p.id, list);
  }
  const merged: Proposal[] = [];
  for (const [, group] of byId) {
    const withNet = group.filter((p) => p.networkId);
    if (withNet.length === 0) {
      merged.push(group[0]);
      continue;
    }
    const first = withNet[0];
    const networkIds = withNet.map((p) => p.networkId!);
    const status =
      withNet.some((p) => p.status === "active") ? "active" : first.status;
    merged.push({
      ...first,
      networkId: undefined,
      networkIds,
      votesFor: withNet.reduce((s, p) => s + p.votesFor, 0),
      votesAgainst: withNet.reduce((s, p) => s + p.votesAgainst, 0),
      totalVotes: withNet.reduce((s, p) => s + p.totalVotes, 0),
      quorum: withNet.reduce((s, p) => s + p.quorum, 0),
      status,
    });
  }
  return merged;
}

/** Avoid hammering algod/indexer when many proposals exist on one network. */
const PROPOSAL_FETCH_CONCURRENCY = 12;

const VOTE_FETCH_CONCURRENCY = 16;

function proposalIdsFromEvents(events: unknown): string[] {
  const eventsArray = Array.isArray(events) ? events : [events];
  const ids: string[] = [];
  for (const group of eventsArray) {
    if (
      group &&
      typeof group === "object" &&
      (group as { name?: string }).name === "ProposalCreated" &&
      Array.isArray((group as { events?: unknown[] }).events)
    ) {
      for (const ev of (group as { events: unknown[] }).events) {
        if (Array.isArray(ev) && ev.length >= 4) {
          try {
            const decoded = decodeProposalCreatedEvent(
              ev as [string, unknown, unknown, string]
            );
            ids.push(decoded.proposal_id);
          } catch (err) {
            console.error("Failed to decode ProposalCreated event:", err);
          }
        }
      }
    }
  }
  return [...new Set(ids)];
}

async function fetchProposalsForNetwork(netId: NetworkId): Promise<Proposal[]> {
  const events = await getEvents(netId);
  const proposalIds = proposalIdsFromEvents(events).filter(
    (id) => !isProposalBlacklisted(id)
  );
  const out: Proposal[] = [];
  for (let i = 0; i < proposalIds.length; i += PROPOSAL_FETCH_CONCURRENCY) {
    const chunk = proposalIds.slice(i, i + PROPOSAL_FETCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (proposalId) => {
        try {
          const serviceProposal = await getProposal(proposalId, netId);
          return convertServiceProposalToUI(serviceProposal, proposalId, netId);
        } catch (err: unknown) {
          console.error(
            `Failed to fetch proposal ${proposalId} on ${netId}:`,
            err
          );
          return null;
        }
      })
    );
    out.push(...chunkResults.filter((p): p is Proposal => p != null));
  }
  return out;
}

export const useGovernanceData = (networkId: NetworkId | null) => {
  const { activeAccount, signTransactions, activeWallet } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Map<string, boolean>>(new Map());
  const [userVoterInfo, setUserVoterInfo] = useState<Voter | null>(null);

  const yourVotingPower = userVoterInfo
    ? Number(userVoterInfo.voteBasePower) / 1e8
    : 0;

  const mergedProposals = useMemo(
    () => mergeProposalsById(proposals),
    [proposals]
  );

  const stats = useMemo<VotingStats>(
    () => calculateStatsFromProposals(mergedProposals, yourVotingPower),
    [mergedProposals, yourVotingPower]
  );

  // Load proposals from all governance networks (voi-mainnet, algorand-mainnet, etc.)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const governanceNetworks = getNetworksWithGovernance();
        type NetResult =
          | { ok: true; proposals: Proposal[] }
          | { ok: false; proposals: Proposal[]; message: string };

        const results: NetResult[] = await Promise.all(
          governanceNetworks.map(async (netId) => {
            try {
              const proposals = await fetchProposalsForNetwork(netId);
              return { ok: true as const, proposals };
            } catch (err: unknown) {
              console.error(`Failed to fetch governance events for ${netId}:`, err);
              return {
                ok: false as const,
                proposals: [] as Proposal[],
                message: fetchErrorMessage(err),
              };
            }
          })
        );
        const fetchedProposals = results.flatMap((r) => r.proposals);

        if (fetchedProposals.length > 0) {
          setProposals(fetchedProposals);
          setError(null);
        } else {
          setProposals([]);
          const anyNetworkSucceeded = results.some((r) => r.ok);
          if (!anyNetworkSucceeded && governanceNetworks.length > 0) {
            const failed = results.find((r): r is Extract<NetResult, { ok: false }> => !r.ok);
            setError(failed?.message ?? "Failed to load governance data");
          } else {
            setError(null);
          }
        }
      } catch (err: unknown) {
        console.error("Failed to fetch governance data:", err);
        setError(fetchErrorMessage(err));
        setProposals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch voter info when active account or network changes
  useEffect(() => {
    const fetchVoterInfo = async () => {
      if (!activeAccount?.address || !networkId) {
        setUserVoterInfo(null);
        setUserVotes(new Map());
        return;
      }

      try {
        const voterInfo = await getVoter(activeAccount.address, networkId);
        console.log("voterInfo", { voterInfo });
        setUserVoterInfo(voterInfo);
      } catch (err: any) {
        console.error("Failed to fetch voter info:", err);
        setUserVoterInfo(null);
      }
    };

    fetchVoterInfo();
  }, [activeAccount?.address, networkId]);

  // Fetch user votes when proposals or active account changes (use each proposal's networkId)
  useEffect(() => {
    const fetchUserVotes = async () => {
      if (!activeAccount?.address || proposals.length === 0) {
        return;
      }

      try {
        const votesMap = new Map<string, boolean>();
        for (let i = 0; i < proposals.length; i += VOTE_FETCH_CONCURRENCY) {
          const chunk = proposals.slice(i, i + VOTE_FETCH_CONCURRENCY);
          await Promise.all(
            chunk.map(async (proposal) => {
              const netId = (proposal.networkId ?? networkId) as NetworkId | undefined;
              if (!netId) return;
              try {
                const voteValue = await getVote(
                  proposal.id,
                  activeAccount.address,
                  netId
                );
                const key = getVoteKey(proposal);
                if (voteValue === "1") votesMap.set(key, true);
                else if (voteValue === "0") votesMap.set(key, false);
              } catch (err: unknown) {
                console.debug(
                  `No vote found for proposal ${proposal.id}:`,
                  err instanceof Error ? err.message : err
                );
              }
            })
          );
        }
        setUserVotes(votesMap);
      } catch (err: any) {
        console.error("Failed to fetch user votes:", err);
      }
    };

    fetchUserVotes();
  }, [proposals, activeAccount?.address, networkId]);

  const vote = async (proposalId: string, support: boolean, votingPower: number, proposalNetworkId?: NetworkId) => {
    if (!activeAccount?.address) {
      throw new Error("Wallet not connected");
    }

    if (!signTransactions) {
      throw new Error("Transaction signer not available");
    }

    const effectiveNetworkId = (proposalNetworkId ?? networkId) as NetworkId | undefined;
    if (!effectiveNetworkId) {
      throw new Error("Proposal network not set; switch to a governance network to vote");
    }

    try {
      // Call castVote for the proposal's network
      const voteResult = await castVote(
        {
          proposalId,
          support,
          sender: activeAccount.address,
        },
        effectiveNetworkId
      );

      if (!voteResult.success || !voteResult.txns || voteResult.txns.length === 0) {
        throw new Error(voteResult.error || "Failed to create vote transaction");
      }

      // Show toast notification to prompt user to open wallet
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Transaction",
        description: `Please open ${walletName} and sign the vote transaction`,
        duration: 10000,
      });

      // Sign transactions
      const stxns = await signTransactions(
        voteResult.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      // Get the correct algod client for the proposal's network
      const networkConfig = getNetworkConfig(effectiveNetworkId);
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        networkConfig.networkId as any
      );
      if (!algorandNetwork) {
        throw new Error(`Invalid network: ${networkConfig.networkId}`);
      }

      const algorandClients =
        await algorandService.initializeClientsForTransactions(algorandNetwork);

      // Send transaction
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();

      // Wait for confirmation
      await waitForConfirmation(
        algorandClients.algod,
        res.txid,
        4
      );

      const voteKey = proposalNetworkId ? `${proposalNetworkId}-${proposalId}` : proposalId;

      // Refresh vote from contract to ensure accuracy
      // Add a small delay to ensure the contract state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const voteValue = await getVote(proposalId, activeAccount.address, effectiveNetworkId);
        // Vote value: "0" = voted against, "1" = voted for, "2" = hasn't voted
        // Update vote state based on contract value
        if (voteValue === "1") {
          setUserVotes((prev) => new Map(prev).set(voteKey, true));
        } else if (voteValue === "0") {
          setUserVotes((prev) => new Map(prev).set(voteKey, false));
        } else if (voteValue === "2") {
          // If still "2" after voting, remove from map to show vote buttons again
          setUserVotes((prev) => {
            const newMap = new Map(prev);
            newMap.delete(voteKey);
            return newMap;
          });
        } else {
          // Fallback to optimistic update if value is unexpected
          console.warn(`Unexpected vote value: ${voteValue}, using optimistic update`);
          setUserVotes((prev) => new Map(prev).set(voteKey, support));
        }
      } catch (err) {
        console.error("Failed to refresh vote after casting:", err);
        // Fallback to optimistic update - we know what we voted
        setUserVotes((prev) => new Map(prev).set(voteKey, support));
      }

      // Refresh proposal data to get updated vote counts
      try {
        const updatedProposal = await getProposal(proposalId, effectiveNetworkId);
        const uiProposal = convertServiceProposalToUI(updatedProposal, proposalId, effectiveNetworkId);
        setProposals((prev) =>
          prev.map((p) => (p.id === proposalId && p.networkId === effectiveNetworkId ? uiProposal : p))
        );
      } catch (err) {
        console.error("Failed to refresh proposal after vote:", err);
        // Still update optimistically if refresh fails
        setProposals((prev) =>
          prev.map((p) => {
            if (p.id === proposalId && p.networkId === effectiveNetworkId) {
              return {
                ...p,
                votesFor: support ? p.votesFor + votingPower : p.votesFor,
                votesAgainst: !support ? p.votesAgainst + votingPower : p.votesAgainst,
                totalVotes: p.totalVotes + votingPower,
              };
            }
            return p;
          })
        );
      }

      toast({
        title: "Vote Submitted",
        description: `Your vote has been successfully recorded on-chain`,
      });
    } catch (err: any) {
      console.error("Failed to cast vote:", err);
      toast({
        title: "Vote Failed",
        description: err?.message || "Failed to submit vote. Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const batchVote = async (votes: Array<{ proposalId: string; support: boolean }>, votingPower: number) => {
    if (!activeAccount?.address) {
      throw new Error("Wallet not connected");
    }

    if (!signTransactions) {
      throw new Error("Transaction signer not available");
    }

    if (votes.length === 0) {
      throw new Error("No votes provided");
    }

    // Batch vote is for current network only
    if (!networkId) {
      throw new Error("Switch to a governance network to submit batch vote");
    }

    try {
      // Call castBatchVote for current network
      const voteResult = await castBatchVote(
        {
          votes: votes.map(v => ({
            proposalId: v.proposalId,
            support: v.support,
          })),
          sender: activeAccount.address,
        },
        networkId
      );

      if (!voteResult.success || !voteResult.txns || voteResult.txns.length === 0) {
        throw new Error(voteResult.error || "Failed to create batch vote transaction");
      }

      // Show toast notification to prompt user to open wallet
      const walletName = activeWallet?.metadata?.name || "your wallet";
      toast({
        title: "Please Sign Transaction",
        description: `Please open ${walletName} and sign the batch vote transaction for ${votes.length} proposal${votes.length > 1 ? 's' : ''}`,
        duration: 10000,
      });

      // Sign transactions
      const stxns = await signTransactions(
        voteResult.txns.map((txn: string) =>
          Uint8Array.from(atob(txn), (c) => c.charCodeAt(0))
        )
      );

      // Get the correct algod client for the network
      const networkConfig = getNetworkConfig(networkId);
      const algorandNetwork = getAlgorandNetworkFromNetworkId(
        networkConfig.networkId as any
      );
      if (!algorandNetwork) {
        throw new Error(`Invalid network: ${networkConfig.networkId}`);
      }

      const algorandClients =
        await algorandService.initializeClientsForTransactions(algorandNetwork);

      // Send transaction
      const res = await algorandClients.algod.sendRawTransaction(stxns).do();

      // Wait for confirmation
      await waitForConfirmation(
        algorandClients.algod,
        res.txid,
        4
      );

      // Refresh votes from contract to ensure accuracy
      // Add a small delay to ensure the contract state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update vote state for all voted proposals (batch is current network only)
      const updatedVotes = new Map(userVotes);
      for (const vote of votes) {
        const voteKey = getVoteKey({ id: vote.proposalId, networkId });
        try {
          const voteValue = await getVote(vote.proposalId, activeAccount.address, networkId);
          if (voteValue === "1") {
            updatedVotes.set(voteKey, true);
          } else if (voteValue === "0") {
            updatedVotes.set(voteKey, false);
          } else if (voteValue === "2") {
            updatedVotes.delete(voteKey);
          } else {
            updatedVotes.set(voteKey, vote.support);
          }
        } catch (err) {
          console.error(`Failed to refresh vote for proposal ${vote.proposalId}:`, err);
          updatedVotes.set(voteKey, vote.support);
        }
      }
      setUserVotes(updatedVotes);

      // Refresh proposal data to get updated vote counts
      for (const vote of votes) {
        try {
          const updatedProposal = await getProposal(vote.proposalId, networkId);
          const uiProposal = convertServiceProposalToUI(updatedProposal, vote.proposalId, networkId);
          setProposals((prev) =>
            prev.map((p) => (p.id === vote.proposalId && p.networkId === networkId ? uiProposal : p))
          );
        } catch (err) {
          console.error(`Failed to refresh proposal ${vote.proposalId} after vote:`, err);
          setProposals((prev) =>
            prev.map((p) => {
              if (p.id === vote.proposalId && p.networkId === networkId) {
                return {
                  ...p,
                  votesFor: vote.support ? p.votesFor + votingPower : p.votesFor,
                  votesAgainst: !vote.support ? p.votesAgainst + votingPower : p.votesAgainst,
                  totalVotes: p.totalVotes + votingPower,
                };
              }
              return p;
            })
          );
        }
      }

      toast({
        title: "Batch Vote Submitted",
        description: `Your votes for ${votes.length} proposal${votes.length > 1 ? 's have' : ' has'} been successfully recorded on-chain`,
      });
    } catch (err: any) {
      console.error("Failed to cast batch vote:", err);
      toast({
        title: "Batch Vote Failed",
        description: err?.message || "Failed to submit batch vote. Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const getProposalsByStatus = (status: Proposal["status"]) => {
    return mergedProposals.filter((p) => p.status === status);
  };

  const getProposalsByCategory = (category: Proposal["category"]) => {
    return mergedProposals.filter((p) => p.category === category);
  };

  return {
    proposals: mergedProposals,
    stats,
    loading,
    error,
    userVotes,
    userVoterInfo,
    vote,
    batchVote,
    getVoteKey,
    getProposalsByStatus,
    getProposalsByCategory,
  };
};
