/**
 * Governance Service - Functions for governance proposal operations
 *
 * This service handles creating and managing governance proposals.
 */

import {
  getCurrentNetworkConfig,
  getNetworkConfig,
  getContractAddress,
  isCurrentNetworkEVM,
  isCurrentNetworkAVM,
  NetworkId,
  GovernanceConfig,
} from "@/config";
import { abi, CONTRACT } from "ulujs";
import algorandService, { AlgorandNetwork } from "./algorandService";
import algosdk, { TransactionSigner } from "algosdk";
import { ProposalCategory } from "@/types/governanceTypes";
import { getCategoryId } from "@/constants/governanceConstants";
import { APP_SPEC as UNITGovernanceAppSpec, PowerSnapshot, PowerSource } from "@/clients/UNITGovernanceClient";

export interface CreateProposalParams {
  proposalTitle: string;
  proposalDescription: string;
  proposalCategoryId: number;
  proposalStartTimestamp: number; // Unix timestamp in seconds
  signer: TransactionSigner;
  sender: string;
}

export interface CreateProposalResult {
  success: boolean;
  proposalId?: string;
  txns?: string[];
  error?: any;
}

/**
 * Creates a new governance proposal
 * @param params Proposal creation parameters
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<CreateProposalResult> The result of the proposal creation
 */
export const createProposal = async (
  params: CreateProposalParams,
  networkId?: NetworkId
): Promise<CreateProposalResult> => {
  try {
    const networkConfig = networkId
      ? getNetworkConfig(networkId)
      : getCurrentNetworkConfig();

    if (!isCurrentNetworkAVM()) {
      throw new Error("Governance proposals are only supported on AVM networks");
    }

    const governanceConfig = getContractAddress(
      networkId || (networkConfig.networkId as NetworkId)
      , "governance",
    ) as GovernanceConfig | string | undefined;

    if (!governanceConfig) {
      throw new Error("Governance contract not configured for this network");
    }

    const appId =
      typeof governanceConfig === "string"
        ? Number(governanceConfig)
        : governanceConfig.appId;

    const clients = algorandService.initializeClients(
      networkConfig.walletNetworkId as AlgorandNetwork
    );

    // Convert title and description to bytes
    const titleBytes = new TextEncoder().encode(params.proposalTitle);
    const descriptionBytes = new TextEncoder().encode(params.proposalDescription);

    // Ensure title is max 64 bytes and description is max 512 bytes
    if (titleBytes.length > 64) {
      throw new Error("Proposal title must be 64 bytes or less");
    }
    if (descriptionBytes.length > 512) {
      throw new Error("Proposal description must be 512 bytes or less");
    }

    // Pad title to 64 bytes and description to 512 bytes
    const paddedTitle = new Uint8Array(64);
    paddedTitle.set(titleBytes);
    const paddedDescription = new Uint8Array(512);
    paddedDescription.set(descriptionBytes);

    // Create contract instance
    // TODO: Replace with actual governance contract spec when available
    const ci = new CONTRACT(
      appId,
      clients.algod,
      undefined,
      abi.custom,
      {
        addr: params.sender,
        sk: new Uint8Array(),
      }
    );

    const ciGovernance = new CONTRACT(
      appId,
      clients.algod,
      undefined,
      {
        ...UNITGovernanceAppSpec.contract, events: []
      },
      {
        addr: params.sender,
        sk: new Uint8Array(),
      }
    );

    const builder = {
      governance: new CONTRACT(
        appId,
        clients.algod,
        undefined,
        {
          ...UNITGovernanceAppSpec.contract, events: []
        },
        {
          addr: params.sender,
          sk: new Uint8Array(),
        },
        true,
        false,
        true
      )
    }

    const buildN = []

    // create proposal
    let proposalId: Uint8Array;
    let hexProposalId: string;
    {
      ciGovernance.setEnableRawBytes(true);
      const proposeR = (await ciGovernance.propose(
        paddedTitle,
        paddedDescription,
        BigInt(params.proposalCategoryId),
        BigInt(params.proposalStartTimestamp),
      ))
      if (!proposeR.success) {
        throw new Error("Failed to create proposal");
      }
      proposalId = proposeR.returnValue
      hexProposalId = Buffer.from(proposalId).toString('hex').slice(0, 8);
      const txnO = (await builder.governance.propose(
        paddedTitle,
        paddedDescription,
        BigInt(params.proposalCategoryId),
        BigInt(params.proposalStartTimestamp),
      )).obj;
      const note = new TextEncoder().encode(`governance propose ${hexProposalId}`);
      buildN.push({
        ...txnO,
        note: note,
      });
    }

    // activate proposal
    {
      const txnO = (await builder.governance.activate_proposal(
        proposalId,
      )).obj;
      const note = new TextEncoder().encode(`governance activate proposal ${hexProposalId}`);
      buildN.push({
        ...txnO,
        note
      });
    }

    ci.setExtraTxns(buildN);
    ci.setEnableGroupResourceSharing(true);
    const result = await ci.custom();

    if (!result.success) {
      return {
        success: false,
        error: result.returnValue || "Failed to create proposal",
      };
    }

    return {
      success: true,
      proposalId: Buffer.from(proposalId).toString('hex'),
      txns: result.txns,
    };
  } catch (error: any) {
    console.error("Failed to create proposal:", error);
    return {
      success: false,
      error: error?.message || "Unknown error occurred",
    };
  }
};

/**
 * Helper function to create a proposal with category string
 * @param proposalTitle Proposal title
 * @param proposalDescription Proposal description
 * @param proposalCategory Proposal category string
 * @param proposalStartTimestamp Unix timestamp in seconds
 * @param signer Transaction signer
 * @param sender Sender address
 * @param networkId Optional network ID
 * @returns Promise<CreateProposalResult>
 */
export const createProposalWithCategory = async (
  proposalTitle: string,
  proposalDescription: string,
  proposalCategory: ProposalCategory,
  proposalStartTimestamp: number,
  signer: TransactionSigner,
  sender: string,
  networkId?: NetworkId
): Promise<CreateProposalResult> => {
  const categoryId = getCategoryId(proposalCategory);

  return createProposal(
    {
      proposalTitle,
      proposalDescription,
      proposalCategoryId: categoryId,
      proposalStartTimestamp,
      signer,
      sender,
    },
    networkId
  );
};

interface ProposalCreatedEvent {
  txid: string;
  proposal_id: string;
}

type ProposalCreatedRawEvent = [
  string,
  any,
  any,
  string
]

export const decodeProposalCreatedEvent = (event: ProposalCreatedRawEvent): ProposalCreatedEvent => {
  return {
    txid: event[0],
    proposal_id: event[3],
  }
}

export const getEvents = async () => {
  const networkConfig = getCurrentNetworkConfig();
  const governanceConfig = getContractAddress(
    networkConfig.networkId as NetworkId,
    "governance",
  ) as GovernanceConfig | string | undefined;
  if (!governanceConfig) {
    throw new Error("Governance contract not configured for this network");
  }
  const appId = typeof governanceConfig === "string" ? Number(governanceConfig) : governanceConfig.appId;
  const clients = algorandService.initializeClients(networkConfig.walletNetworkId as AlgorandNetwork);
  console.log({ appId, clients });
  const ci = new CONTRACT(
    appId,
    clients.algod,
    clients.indexer,
    {
      ...UNITGovernanceAppSpec.contract,
      events: [
        {
          name: "ProposalCreated",
          args: [{ type: "byte[32]", name: "proposal_id" }],
        },
        {
          name: "ProposalActivated",
          args: [{ type: "byte[32]", name: "proposal_id" }],
        },
      ],
    },
    {
      addr: (algosdk.encodeAddress(algosdk.getApplicationAddress(appId).publicKey)) as string,
      sk: new Uint8Array(),
    },
  );
  const status = await clients.algod.status().do();
  const lastRound = status.lastRound;
  const events = await ci.getEvents({
    minRound: Math.max(0, Number(lastRound) - 2e6)
  });
  console.log("events", { events });
  return events;
}

export interface Proposal {
  proposalIndex: string;
  proposalStatus: string;
  proposer: string;
  proposalTitle: string;
  proposalDescription: string;
  proposalNode: string;
  proposalCategoryId: string;
  proposalTotalVotes: string;
  proposalYesVotes: string;
  proposalTotalPower: string;
  proposalActivationPower: string;
  createdAtTimestamp: string;
  votingStartTimestamp: string;
  votingEndTimestamp: string;
  proposalActionHash: string;
  executedAtTimestamp: string;
  executionTxnId: string;
  proposalActivationTimestamp: string;
  proposalQuorumThreshold: string;
  proposalQuorumMet: boolean;
  proposalQuorumStatus: string;
  proposalYesPower: string;
}

type ProposalRaw = [
  bigint,
  bigint,
  string,
  Uint8Array,
  Uint8Array,
  Uint8Array,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  Uint8Array,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  bigint,
  bigint,
]

export const decodeProposal = (proposal: ProposalRaw): Proposal => {
  return {
    proposalIndex: proposal[0].toString(),
    proposalStatus: proposal[1].toString(),
    proposer: proposal[2],
    proposalTitle: Buffer.from(proposal[3]).toString('utf-8'),
    proposalDescription: Buffer.from(proposal[4]).toString('utf-8'),
    proposalNode: Buffer.from(proposal[5]).toString('hex'),
    proposalCategoryId: proposal[6].toString(),
    proposalTotalVotes: proposal[7].toString(),
    proposalYesVotes: proposal[8].toString(),
    proposalTotalPower: proposal[9].toString(),
    proposalActivationPower: proposal[10].toString(),
    createdAtTimestamp: proposal[11].toString(),
    votingStartTimestamp: proposal[12].toString(),
    votingEndTimestamp: proposal[13].toString(),
    proposalActionHash: Buffer.from(proposal[14]).toString('hex'),
    executedAtTimestamp: proposal[15].toString(),
    executionTxnId: proposal[16].toString(),
    proposalActivationTimestamp: proposal[17].toString(),
    proposalQuorumThreshold: proposal[18].toString(),
    proposalQuorumMet: proposal[19],
    proposalQuorumStatus: proposal[20].toString(),
    proposalYesPower: proposal[21].toString(),
  }
}

/**
 * Gets a governance proposal by proposal ID
 * @param proposalId Proposal ID as hex string or Uint8Array (proposal node)
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<Proposal> The proposal data
 */
export const getProposal = async (
  proposalId: string | Uint8Array,
  networkId?: NetworkId
): Promise<Proposal> => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();

  if (!isCurrentNetworkAVM()) {
    throw new Error("Governance proposals are only supported on AVM networks");
  }

  const governanceConfig = getContractAddress(
    networkId || (networkConfig.networkId as NetworkId),
    "governance",
  ) as GovernanceConfig | string | undefined;

  if (!governanceConfig) {
    throw new Error("Governance contract not configured for this network");
  }

  const appId =
    typeof governanceConfig === "string"
      ? Number(governanceConfig)
      : governanceConfig.appId;

  const clients = algorandService.initializeClients(
    networkConfig.walletNetworkId as AlgorandNetwork
  );

  // Convert proposalId to Uint8Array if it's a hex string
  let proposalNode: Uint8Array;
  if (typeof proposalId === "string") {
    // Remove 0x prefix if present and ensure it's 64 hex chars (32 bytes)
    const hex = proposalId.startsWith("0x") ? proposalId.slice(2) : proposalId;
    // Pad to 64 hex chars if needed (32 bytes)
    const paddedHex = hex.padStart(64, "0").slice(0, 64);
    proposalNode = Uint8Array.from(Buffer.from(paddedHex, "hex"));
  } else {
    proposalNode = proposalId;
  }

  // Ensure proposalNode is exactly 32 bytes
  if (proposalNode.length !== 32) {
    const padded = new Uint8Array(32);
    padded.set(proposalNode.slice(0, 32));
    proposalNode = padded;
  }

  const ci = new CONTRACT(
    appId,
    clients.algod,
    undefined,
    {
      ...UNITGovernanceAppSpec.contract,
      events: [],
    },
    {
      addr: algosdk.encodeAddress(algosdk.getApplicationAddress(appId).publicKey),
      sk: new Uint8Array(),
    },
  );

  ci.setEnableRawBytes(true);
  const result = await ci.get_proposal(proposalNode);

  console.log("getProposal result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to get proposal");
  }

  return decodeProposal(result.returnValue);
};

export interface Voter {
  voterAddress: string;
  votePower: string;
  voteTimestamp: string;
  proposalsParticipated: string;
  lastParticipationTimestamp: string;
  lastProposalNode: string;
}

type VoterRaw = [
  string,
  bigint,
  bigint,
  bigint,
  bigint,
  Uint8Array,
]

export const decodeVoter = (voter: VoterRaw): Voter => {
  return {
    voterAddress: voter[0],
    votePower: voter[1].toString(),
    voteTimestamp: voter[2].toString(),
    proposalsParticipated: voter[3].toString(),
    lastParticipationTimestamp: voter[4].toString(),
    lastProposalNode: Buffer.from(voter[5]).toString('hex'),
  }
}

/**
 * Gets voter information by voter address
 * @param voterAddress Voter address as string
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<Voter> The voter data
 */
export const getVoter = async (
  voterAddress: string,
  networkId?: NetworkId
): Promise<Voter> => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();

  if (!isCurrentNetworkAVM()) {
    throw new Error("Governance proposals are only supported on AVM networks");
  }

  const governanceConfig = getContractAddress(
    networkId || (networkConfig.networkId as NetworkId),
    "governance",
  ) as GovernanceConfig | string | undefined;

  if (!governanceConfig) {
    throw new Error("Governance contract not configured for this network");
  }

  const appId =
    typeof governanceConfig === "string"
      ? Number(governanceConfig)
      : governanceConfig.appId;

  const clients = algorandService.initializeClients(
    networkConfig.walletNetworkId as AlgorandNetwork
  );

  const ci = new CONTRACT(
    appId,
    clients.algod,
    undefined,
    {
      ...UNITGovernanceAppSpec.contract,
      events: [],
    },
    {
      addr: algosdk.encodeAddress(algosdk.getApplicationAddress(appId).publicKey),
      sk: new Uint8Array(),
    },
  );

  ci.setFee(2000);
  ci.setEnableRawBytes(true);
  const result = await ci.get_voter(voterAddress);

  console.log("getVoter result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to get voter");
  }

  return decodeVoter(result.returnValue);
};

/**
 * Gets power source information by power source ID
 * @param powerSourceId Power source appId
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<PowerSource> The power source data
 */
export const getPowerSource = async (
  powerSourceId: number,
  networkId?: NetworkId
): Promise<PowerSource> => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();

  if (!isCurrentNetworkAVM()) {
    throw new Error("Governance power sources are only supported on AVM networks");
  }

  const governanceConfig = getContractAddress(
    networkId || (networkConfig.networkId as NetworkId),
    "governance",
  ) as GovernanceConfig | string | undefined;

  if (!governanceConfig) {
    throw new Error("Governance contract not configured for this network");
  }

  const appId =
    typeof governanceConfig === "string"
      ? Number(governanceConfig)
      : governanceConfig.appId;

  const clients = algorandService.initializeClients(
    networkConfig.walletNetworkId as AlgorandNetwork
  );

  const ci = new CONTRACT(
    appId,
    clients.algod,
    undefined,
    {
      ...UNITGovernanceAppSpec.contract,
      events: [],
    },
    {
      addr: algosdk.encodeAddress(algosdk.getApplicationAddress(appId).publicKey),
      sk: new Uint8Array(),
    },
  );

  ci.setFee(2000);
  ci.setEnableRawBytes(true);
  const result = await ci.get_power_source(BigInt(powerSourceId));

  console.log("getPowerSource result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to get power source");
  }

  return PowerSource(result.returnValue);
};

/**
 * Snaps power for a given power source
 * @param powerSourceId Power source appId to snap power for
 * @param signer Transaction signer
 * @param sender Sender address
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<{ snapshot: PowerSnapshot; txns: string[] }> The power snapshot data and transaction IDs
 */
export const snapPower = async (
  powerSourceId: number,
  signer: TransactionSigner,
  sender: string,
  networkId?: NetworkId
): Promise<{ snapshot: PowerSnapshot; txns: string[] }> => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();

  if (!isCurrentNetworkAVM()) {
    throw new Error("Governance snap power is only supported on AVM networks");
  }

  const governanceConfig = getContractAddress(
    networkId || (networkConfig.networkId as NetworkId),
    "governance",
  ) as GovernanceConfig | string | undefined;

  if (!governanceConfig) {
    throw new Error("Governance contract not configured for this network");
  }

  const appId =
    typeof governanceConfig === "string"
      ? Number(governanceConfig)
      : governanceConfig.appId;

  const clients = algorandService.initializeClients(
    networkConfig.walletNetworkId as AlgorandNetwork
  );

  const ci = new CONTRACT(
    appId,
    clients.algod,
    undefined,
    {
      ...UNITGovernanceAppSpec.contract,
      events: [],
    },
    {
      addr: sender,
      sk: new Uint8Array(),
    },
  );

  ci.setFee(4000);
  ci.setEnableRawBytes(true);
  const result = await ci.snap_power(BigInt(powerSourceId));

  console.log("snapPower result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to snap power");
  }

  const snapshot = PowerSnapshot(result.returnValue);

  return {
    snapshot,
    txns: result.txns || [],
  };
};
