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
  isAVMNetwork,
  NetworkId,
  GovernanceConfig,
} from "@/config";
import { abi, CONTRACT } from "ulujs";
import algorandService, { AlgorandNetwork } from "./algorandService";
import algosdk, { TransactionSigner } from "algosdk";
import { ProposalCategory } from "@/types/governanceTypes";
import { getCategoryId } from "@/constants/governanceConstants";
import { APP_SPEC as UNITGovernanceAppSpec, PowerSnapshot, PowerSource, PowerMultiplierSnapshot } from "@/clients/UNITGovernanceClient";

/** Default number of rounds to look back when fetching governance events (ProposalCreated, etc.). */
export const GOVERNANCE_EVENTS_MIN_ROUNDS_LOOKBACK = 2e6;

/** Per-network minimum round for governance events (genesis/first governance round). */
const GOVERNANCE_EVENTS_MIN_ROUND_BY_NETWORK: Partial<Record<NetworkId, number>> = {
  "voi-mainnet": 15_624_000,
};

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
      ciGovernance.setPaymentAmount(320000);
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
        payment: 320000
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
    if (networkConfig.networkId === "algorand-mainnet") {
      ci.setBeaconId(3209233839); // TODO move this to ulujs
    }
    const result = await ci.custom();

    console.log("createProposal result", { result });

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

/**
 * Fetches governance events (ProposalCreated, etc.) for a network.
 * @param networkId Optional network ID, defaults to current network
 */
export const getEvents = async (networkId?: NetworkId) => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();
  const nid = networkConfig.networkId as NetworkId;
  const governanceConfig = getContractAddress(nid, "governance") as
    | GovernanceConfig
    | string
    | undefined;
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
      addr: algosdk.encodeAddress(
        algosdk.getApplicationAddress(appId).publicKey
      ) as string,
      sk: new Uint8Array(),
    }
  );
  const status = await clients.algod.status().do();
  const lastRound = status.lastRound;
  const minRoundForNetwork =
    GOVERNANCE_EVENTS_MIN_ROUND_BY_NETWORK[nid] ?? 0;
  const minRound = Math.max(
    minRoundForNetwork,
    Number(lastRound) - GOVERNANCE_EVENTS_MIN_ROUNDS_LOOKBACK
  );
  if (nid === "algorand-mainnet") {
    ci.setBeaconId(3209233839); // Beacon required for Algorand mainnet governance reads
  }
  const events = await ci.getEvents({ minRound });
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
  const effectiveNetworkId = (networkId ?? networkConfig.networkId) as NetworkId;

  if (!(networkId ? isAVMNetwork(networkId) : isCurrentNetworkAVM())) {
    throw new Error("Governance proposals are only supported on AVM networks");
  }

  const governanceConfig = getContractAddress(
    effectiveNetworkId,
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
  if (networkConfig.networkId === "algorand-mainnet") {
    ci.setBeaconId(3209233839); // Beacon required for Algorand mainnet governance reads
  }
  const result = await ci.get_proposal(proposalNode);

  console.log("getProposal result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to get proposal");
  }

  return decodeProposal(result.returnValue);
};


// class Voter(arc4.Struct):
//     voter_address: arc4.Address
//     vote_base_power: arc4.UInt256
//     vote_lock_power: arc4.UInt256
//     vote_multiplier: arc4.UInt256
//     vote_total_power: arc4.UInt256
//     vote_timestamp: arc4.UInt64
//     proposals_participated: (
//         arc4.UInt64
//     )  # Number of proposals this voter has participated in
//     last_participation_timestamp: arc4.UInt64  # Timestamp of last participation
//     last_snapshot_timestamp: arc4.UInt64  # Timestamp of last power snapshot
//     last_proposal_node: Bytes32  # Node of the last proposal this voter participated in

export interface Voter {
  voterAddress: string;
  voteBasePower: string;
  voteLockPower: string;
  voteMultiplier: string;
  voteTotalPower: string;
  voteTimestamp: string;
  proposalsParticipated: string;
  lastParticipationTimestamp: string;
  lastSnapshotTimestamp: string;
  lastProposalNode: string;
}

type VoterRaw = [
  string,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  Uint8Array,
]

export const decodeVoter = (voter: VoterRaw): Voter => {
  return {
    voterAddress: voter[0],
    voteBasePower: voter[1].toString(),
    voteLockPower: voter[2].toString(),
    voteMultiplier: voter[3].toString(),
    voteTotalPower: voter[4].toString(),
    voteTimestamp: voter[5].toString(),
    proposalsParticipated: voter[6].toString(),
    lastParticipationTimestamp: voter[7].toString(),
    lastSnapshotTimestamp: voter[8].toString(),
    lastProposalNode: Buffer.from(voter[9]).toString('hex'),
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
  const effectiveNetworkId = (networkId ?? networkConfig.networkId) as NetworkId;

  if (!(networkId ? isAVMNetwork(networkId) : isCurrentNetworkAVM())) {
    throw new Error("Governance proposals are only supported on AVM networks");
  }

  const governanceConfig = getContractAddress(
    effectiveNetworkId,
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

  ci.setFee(7000);
  ci.setEnableRawBytes(true);
  if (networkConfig.networkId === "algorand-mainnet") {
    ci.setBeaconId(3209233839); // Beacon required for Algorand mainnet governance reads
  }
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
  if (networkConfig.networkId === "algorand-mainnet") {
    ci.setBeaconId(3209233839); // Beacon required for Algorand mainnet governance reads
  }
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

// class PowerMultiplier(arc4.Struct):
//     power_multiplier_id: arc4.UInt64
//     power_multiplier_value: arc4.UInt64
//     power_multiplier_supported_modes: arc4.UInt64


interface PowerMultiplier {
  powerMultiplierId: string;
  powerMultiplierValue: string;
  powerMultiplierSupportedModes: string;
}

type PowerMultiplierRaw = [
  bigint,
  bigint,
  bigint,
]

export const decodePowerMultiplier = (powerMultiplier: PowerMultiplierRaw): PowerMultiplier => {
  return {
    powerMultiplierId: powerMultiplier[0].toString(),
    powerMultiplierValue: powerMultiplier[1].toString(),
    powerMultiplierSupportedModes: powerMultiplier[2].toString(),
  }
}

export const getPowerMultiplier = async (
  powerMultiplierId: number,
  networkId?: NetworkId
): Promise<PowerMultiplier> => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();

  if (!isCurrentNetworkAVM()) {
    throw new Error("Governance power multipliers are only supported on AVM networks");
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
  if (networkConfig.networkId === "algorand-mainnet") {
    ci.setBeaconId(3209233839); // Beacon required for Algorand mainnet governance reads
  }
  const result = await ci.get_power_multiplier(BigInt(powerMultiplierId));

  console.log("getPowerMultiplier result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to get power multiplier");
  }

  return decodePowerMultiplier(result.returnValue);
};

/**
 * Snaps multiplier for a given power multiplier ID
 * @param powerMultiplierId Power multiplier ID to snap multiplier for
 * @param signer Transaction signer
 * @param sender Sender address
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<{ snapshot: PowerMultiplierSnapshot; txns: string[] }> The power multiplier snapshot data and transaction IDs
 */
export const snapMultiplier = async (
  powerMultiplierId: number,
  signer: TransactionSigner,
  sender: string,
  networkId?: NetworkId
): Promise<{ snapshot: PowerMultiplierSnapshot; txns: string[] }> => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();

  if (!isCurrentNetworkAVM()) {
    throw new Error("Governance snap multiplier is only supported on AVM networks");
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

  ci.setFee(7000);
  ci.setEnableRawBytes(true);
  const result = await ci.snap_multiplier(BigInt(powerMultiplierId));

  console.log("snapMultiplier result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to snap multiplier");
  }

  const snapshot = PowerMultiplierSnapshot(result.returnValue);

  return {
    snapshot,
    txns: result.txns || [],
  };
};

export const getVoterBasePower = async (
  voterAddress: string,
  networkId?: NetworkId
): Promise<string> => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();

  if (!isCurrentNetworkAVM()) {
    throw new Error("Governance get voter base power is only supported on AVM networks");
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
  ci.setFee(7000);
  ci.setEnableRawBytes(true);
  if (networkConfig.networkId === "algorand-mainnet") {
    ci.setBeaconId(3209233839); // Beacon required for Algorand mainnet governance reads
  }
  const result = await ci.get_voter_base_power(voterAddress);
  console.log("getVoterBasePower result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to get voter base power");
  }

  return result.returnValue.toString();
};

export const getVoterMultiplier = async (
  voterAddress: string,
  networkId?: NetworkId
): Promise<string> => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();

  if (!isCurrentNetworkAVM()) {
    throw new Error("Governance get voter multiplier is only supported on AVM networks");
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
  ci.setFee(7000);
  ci.setEnableRawBytes(true);
  if (networkConfig.networkId === "algorand-mainnet") {
    ci.setBeaconId(3209233839); // Beacon required for Algorand mainnet governance reads
  }
  const result = await ci.get_voter_multiplier(voterAddress);
  console.log("getVoterMultiplier result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to get voter multiplier");
  }

  return result.returnValue.toString();
};

/**
 * Gets a vote for a specific proposal and voter
 * @param proposalId Proposal ID as hex string or Uint8Array (proposal node)
 * @param voterAddress Voter address as string
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<string> The vote value ("0" = against/no vote, "1" = for)
 */
export const getVote = async (
  proposalId: string | Uint8Array,
  voterAddress: string,
  networkId?: NetworkId
): Promise<string> => {
  const networkConfig = networkId
    ? getNetworkConfig(networkId)
    : getCurrentNetworkConfig();
  const effectiveNetworkId = (networkId ?? networkConfig.networkId) as NetworkId;

  if (!(networkId ? isAVMNetwork(networkId) : isCurrentNetworkAVM())) {
    throw new Error("Governance get vote is only supported on AVM networks");
  }

  const governanceConfig = getContractAddress(
    effectiveNetworkId,
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

  ci.setFee(2000);
  ci.setEnableRawBytes(true);
  if (networkConfig.networkId === "algorand-mainnet") {
    ci.setBeaconId(3209233839); // Beacon required for Algorand mainnet governance reads
  }
  const result = await ci.get_vote(proposalNode, voterAddress);

  console.log("getVote result", { result });

  if (!result.success) {
    throw new Error(result.returnValue || "Failed to get vote");
  }

  return result.returnValue.toString();
};

export interface CastVoteParams {
  proposalId: string | Uint8Array;
  support: boolean; // true = for, false = against
  sender: string;
}

export interface CastVoteResult {
  success: boolean;
  txns?: string[];
  error?: any;
}

export interface BatchVoteParams {
  votes: Array<{
    proposalId: string | Uint8Array;
    support: boolean;
  }>;
  sender: string;
}

export interface BatchVoteResult {
  success: boolean;
  txns?: string[];
  error?: any;
}

/**
 * Casts a vote on a governance proposal
 * @param params Vote parameters including proposal ID, support (true = for, false = against), and sender
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<CastVoteResult> The result of the vote transaction
 */
export const castVote = async (
  params: CastVoteParams,
  networkId?: NetworkId
): Promise<CastVoteResult> => {
  try {
    const networkConfig = networkId
      ? getNetworkConfig(networkId)
      : getCurrentNetworkConfig();

    if (!(networkId ? isAVMNetwork(networkId) : isCurrentNetworkAVM())) {
      throw new Error("Governance voting is only supported on AVM networks");
    }

    const governanceConfig = getContractAddress(
      networkId ?? (networkConfig.networkId as NetworkId),
      "governance",
    ) as GovernanceConfig | string | undefined;

    if (!governanceConfig) {
      throw new Error("Governance contract not configured for this network");
    }

    const appId =
      typeof governanceConfig === "string"
        ? Number(governanceConfig)
        : governanceConfig.appId;

    // Get storage app ID from governance config
    if (typeof governanceConfig === "string") {
      throw new Error("Governance config must be a GovernanceConfig object with storageAppId");
    }
    const storageAppId = governanceConfig.storageAppId;

    const clients = algorandService.initializeClients(
      networkConfig.walletNetworkId as AlgorandNetwork
    );

    // Convert proposalId to Uint8Array if it's a hex string
    let proposalNode: Uint8Array;
    if (typeof params.proposalId === "string") {
      // Remove 0x prefix if present and ensure it's 64 hex chars (32 bytes)
      const hex = params.proposalId.startsWith("0x") ? params.proposalId.slice(2) : params.proposalId;
      // Pad to 64 hex chars if needed (32 bytes)
      const paddedHex = hex.padStart(64, "0").slice(0, 64);
      proposalNode = Uint8Array.from(Buffer.from(paddedHex, "hex"));
    } else {
      proposalNode = params.proposalId;
    }

    // Ensure proposalNode is exactly 32 bytes
    if (proposalNode.length !== 32) {
      const padded = new Uint8Array(32);
      padded.set(proposalNode.slice(0, 32));
      proposalNode = padded;
    }

    // Vote value: 0 = against, 1 = for
    const voteValue = params.support ? BigInt(1) : BigInt(0);

    // Create contract instance
    const ci = new CONTRACT(
      appId,
      clients.algod,
      undefined,
      abi.custom,
      {
        addr: params.sender,
        sk: new Uint8Array(),
      },
    );
    const builder = {
      governance: new CONTRACT(
        appId,
        clients.algod,
        undefined,
        {
          ...UNITGovernanceAppSpec.contract,
          events: [],
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

    const buildN = [];

    {
      const txnO = (await builder.governance.cast_vote(proposalNode, voteValue)).obj;
      buildN.push({
        ...txnO,
        note: new TextEncoder().encode(`governance cast vote ${Buffer.from(proposalNode).toString('hex').slice(0, 8)}`),
        payment: 2e5,
        foreignApps: [storageAppId],
      });
    }

    ci.setExtraTxns(buildN);
    ci.setFee(8000);
    ci.setEnableGroupResourceSharing(true);
    if (networkConfig.networkId === "algorand-mainnet") {
      ci.setBeaconId(3209233839); // TODO move this to ulujs
    }
    const result = await ci.custom();

    console.log("castVote result", { result });

    if (!result.success) {
      return {
        success: false,
        error: result.returnValue || "Failed to cast vote",
      };
    }

    return {
      success: true,
      txns: result.txns || [],
    };
  } catch (error: any) {
    console.error("Failed to cast vote:", error);
    return {
      success: false,
      error: error?.message || "Unknown error occurred",
    };
  }
};

/**
 * Casts multiple votes on governance proposals in a single batch transaction
 * @param params Batch vote parameters including array of votes and sender
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<BatchVoteResult> The result of the batch vote transaction
 */
export const castBatchVote = async (
  params: BatchVoteParams,
  networkId?: NetworkId
): Promise<BatchVoteResult> => {
  try {
    if (params.votes.length === 0) {
      throw new Error("No votes provided");
    }

    const networkConfig = networkId
      ? getNetworkConfig(networkId)
      : getCurrentNetworkConfig();

    if (!(networkId ? isAVMNetwork(networkId) : isCurrentNetworkAVM())) {
      throw new Error("Governance voting is only supported on AVM networks");
    }

    const governanceConfig = getContractAddress(
      networkId ?? (networkConfig.networkId as NetworkId),
      "governance",
    ) as GovernanceConfig | string | undefined;

    if (!governanceConfig) {
      throw new Error("Governance contract not configured for this network");
    }

    const appId =
      typeof governanceConfig === "string"
        ? Number(governanceConfig)
        : governanceConfig.appId;

    // Get storage app ID from governance config
    if (typeof governanceConfig === "string") {
      throw new Error("Governance config must be a GovernanceConfig object with storageAppId");
    }
    const storageAppId = governanceConfig.storageAppId;

    const clients = algorandService.initializeClients(
      networkConfig.walletNetworkId as AlgorandNetwork
    );

    // Create contract instance
    const ci = new CONTRACT(
      appId,
      clients.algod,
      undefined,
      abi.custom,
      {
        addr: params.sender,
        sk: new Uint8Array(),
      },
    );
    const builder = {
      governance: new CONTRACT(
        appId,
        clients.algod,
        undefined,
        {
          ...UNITGovernanceAppSpec.contract,
          events: [],
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

    const buildN = [];

    // Calculate total payment amount: number of votes * 1e5
    const totalPayment = params.votes.length * 1e5;

    // Build vote transactions for each proposal
    for (let index = 0; index < params.votes.length; index++) {
      const vote = params.votes[index];
      // Convert proposalId to Uint8Array if it's a hex string
      let proposalNode: Uint8Array;
      if (typeof vote.proposalId === "string") {
        // Remove 0x prefix if present and ensure it's 64 hex chars (32 bytes)
        const hex = vote.proposalId.startsWith("0x") ? vote.proposalId.slice(2) : vote.proposalId;
        // Pad to 64 hex chars if needed (32 bytes)
        const paddedHex = hex.padStart(64, "0").slice(0, 64);
        proposalNode = Uint8Array.from(Buffer.from(paddedHex, "hex"));
      } else {
        proposalNode = vote.proposalId;
      }

      // Ensure proposalNode is exactly 32 bytes
      if (proposalNode.length !== 32) {
        const padded = new Uint8Array(32);
        padded.set(proposalNode.slice(0, 32));
        proposalNode = padded;
      }

      // Vote value: 0 = against, 1 = for
      const voteValue = vote.support ? BigInt(1) : BigInt(0);

      const txnO = (await builder.governance.cast_vote(proposalNode, voteValue)).obj;
      buildN.push({
        ...txnO,
        note: new TextEncoder().encode(`governance cast vote ${Buffer.from(proposalNode).toString('hex').slice(0, 8)}`),
        // Only include payment in the first transaction
        payment: index === 0 ? totalPayment : 0,
        foreignApps: [storageAppId],
      });
    }

    ci.setExtraTxns(buildN);
    // Adjust fee based on number of votes (base fee + per-vote fee)
    ci.setFee(8000 + (params.votes.length - 1) * 2000);
    ci.setEnableGroupResourceSharing(true);
    const result = await ci.custom();

    console.log("castBatchVote result", { result, voteCount: params.votes.length });

    if (!result.success) {
      return {
        success: false,
        error: result.returnValue || "Failed to cast batch vote",
      };
    }

    return {
      success: true,
      txns: result.txns || [],
    };
  } catch (error: any) {
    console.error("Failed to cast batch vote:", error);
    return {
      success: false,
      error: error?.message || "Unknown error occurred",
    };
  }
};

export interface CloseVotingEarlyParams {
  proposalId: string | Uint8Array;
  sender: string;
}

export interface CloseVotingEarlyResult {
  success: boolean;
  txns?: string[];
  error?: any;
}

/**
 * Closes voting early for a governance proposal.
 * Updates voting end timestamp to current time so proposal may be finalized early.
 * Typically an owner/admin operation.
 *
 * @param params Close voting early parameters including proposal ID and sender
 * @param networkId Optional network ID, defaults to current network
 * @returns Promise<CloseVotingEarlyResult> The result of the transaction
 */
export const closeVotingEarly = async (
  params: CloseVotingEarlyParams,
  networkId?: NetworkId
): Promise<CloseVotingEarlyResult> => {
  try {
    const networkConfig = networkId
      ? getNetworkConfig(networkId)
      : getCurrentNetworkConfig();

    if (!isCurrentNetworkAVM()) {
      throw new Error("Governance is only supported on AVM networks");
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
    if (typeof params.proposalId === "string") {
      const hex = params.proposalId.startsWith("0x") ? params.proposalId.slice(2) : params.proposalId;
      const paddedHex = hex.padStart(64, "0").slice(0, 64);
      proposalNode = Uint8Array.from(Buffer.from(paddedHex, "hex"));
    } else {
      proposalNode = params.proposalId;
    }

    if (proposalNode.length !== 32) {
      const padded = new Uint8Array(32);
      padded.set(proposalNode.slice(0, 32));
      proposalNode = padded;
    }

    const ci = new CONTRACT(
      appId,
      clients.algod,
      undefined,
      abi.custom,
      {
        addr: params.sender,
        sk: new Uint8Array(),
      },
    );
    const builder = {
      governance: new CONTRACT(
        appId,
        clients.algod,
        undefined,
        {
          ...UNITGovernanceAppSpec.contract,
          events: [],
        },
        {
          addr: params.sender,
          sk: new Uint8Array(),
        },
        true,
        false,
        true
      )
    };

    const buildN = [];
    {
      const txnO = (await builder.governance.close_voting_early(proposalNode)).obj;
      buildN.push({
        ...txnO,
        note: new TextEncoder().encode(`governance close voting early ${Buffer.from(proposalNode).toString('hex').slice(0, 8)}`),
        payment: 2e5,
      });
    }

    ci.setExtraTxns(buildN);
    ci.setFee(8000);
    ci.setEnableGroupResourceSharing(true);
    const result = await ci.custom();

    if (!result.success) {
      return {
        success: false,
        error: result.returnValue || "Failed to close voting early",
      };
    }

    return {
      success: true,
      txns: result.txns || [],
    };
  } catch (error: any) {
    console.error("Failed to close voting early:", error);
    return {
      success: false,
      error: error?.message || "Unknown error occurred",
    };
  }
};