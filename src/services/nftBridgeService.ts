import algosdk, { type Algodv2, type Indexer } from "algosdk";
import type { NetworkId } from "@/config";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import {
  bridgeCustodyAddress,
  bridgeDestinationKind,
  bridgeRegistrationLogAddresses,
  DORK_NFT_BRIDGE_ADDRESS,
  NFT_BRIDGE_NOTE_PREFIX,
  type NftBridgeDirection,
  type NftBridgeIntentItem,
  type NftBridgeIntentPayload,
} from "@/config/nftBridge";
import { getDorkNftByVoi } from "@/data/dorkNftAlgorandRegistry";
import type { UserNFT } from "@/hooks/useUserNFTs";
import { ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP } from "@/services/nftDripClaimService";
import algorandService from "@/services/algorandService";

export type BridgeableNft = UserNFT & {
  sourceId: string;
  /** On-chain id in bridge registration notes (ASA id or Voi contract:token). */
  destAssetId: string;
  /** User-facing receive type: ASA or VSA. */
  destAssetLabel: "ASA" | "VSA";
};

export function bridgeDirectionForNetwork(
  networkId: NetworkId
): NftBridgeDirection {
  return networkId === "voi-mainnet" ? "voi-to-algorand" : "algorand-to-voi";
}

export function destinationNetworkLabel(direction: NftBridgeDirection): string {
  return direction === "voi-to-algorand" ? "Algorand" : "Voi";
}

export function sourceNetworkLabel(direction: NftBridgeDirection): string {
  return direction === "voi-to-algorand" ? "Voi" : "Algorand";
}

export function enrichNftsForBridge(
  nfts: UserNFT[],
  direction: NftBridgeDirection
): BridgeableNft[] {
  const out: BridgeableNft[] = [];
  for (const nft of nfts) {
    const entry = getDorkNftByVoi(nft.contractId, Number(nft.tokenId));
    if (!entry) continue;
    const receiveKind = bridgeDestinationKind(direction);
    if (direction === "voi-to-algorand") {
      out.push({
        ...nft,
        sourceId: `arc72:${nft.contractId}:${nft.tokenId}`,
        destAssetId: String(entry.assetId),
        destAssetLabel: receiveKind,
      });
    } else {
      out.push({
        ...nft,
        sourceId: String(entry.assetId),
        destAssetId: `${entry.voiContractId}:${entry.voiTokenId}`,
        destAssetLabel: receiveKind,
      });
    }
  }
  return out;
}

export function encodeBridgeIntentNote(payload: NftBridgeIntentPayload): Uint8Array {
  const json = JSON.stringify(payload);
  const note = `${NFT_BRIDGE_NOTE_PREFIX}${json}`;
  const bytes = new TextEncoder().encode(note);
  if (bytes.length > 1024) {
    throw new Error("Bridge intent note is too large; select fewer NFTs.");
  }
  return bytes;
}

export function parseBridgeIntentNote(
  note: Uint8Array | string | undefined
): NftBridgeIntentPayload | null {
  if (!note) return null;
  let text: string;
  if (typeof note === "string") {
    text = note;
  } else {
    text = new TextDecoder().decode(note);
  }
  if (!text.startsWith(NFT_BRIDGE_NOTE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(text.slice(NFT_BRIDGE_NOTE_PREFIX.length)) as NftBridgeIntentPayload;
    if (parsed?.v !== 1 || !parsed.receiver || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeSuggestedParams(
  params: algosdk.SuggestedParams
): algosdk.SuggestedParams {
  return {
    ...params,
    fee: BigInt(params.fee),
    firstValid: BigInt(params.firstValid),
    lastValid: BigInt(params.lastValid),
    minFee: params.minFee != null ? BigInt(params.minFee) : undefined,
  };
}

function bridgeIntentItemsFromSelection(
  selected: BridgeableNft[]
): NftBridgeIntentItem[] {
  return selected.map((nft) => ({
    sourceId: nft.sourceId,
    destAssetId: nft.destAssetId,
    name: nft.name,
  }));
}

async function buildArc72TransferBytes(
  contractId: number,
  tokenId: string,
  sender: string,
  algod: Algodv2,
  indexer: Indexer
): Promise<algosdk.Transaction[]> {
  const Arc72 = (await import("ulujs/impl/arc72/index.js")).default;
  const contract = new Arc72(contractId, algod, indexer, {
    simulate: true,
    acc: { addr: sender },
  });
  const result = await contract.arc72_transferFrom(
    sender,
    DORK_NFT_BRIDGE_ADDRESS,
    BigInt(tokenId),
    true,
    false
  );
  if (!result?.success || !Array.isArray(result.txns)) {
    throw new Error(`Could not build Voi NFT transfer for token ${tokenId}.`);
  }
  return (result.txns as string[]).map((b64) =>
    algosdk.decodeUnsignedTransaction(
      Uint8Array.from(Buffer.from(b64, "base64"))
    )
  );
}

async function buildVoiBridgeGroupForNft(
  nft: BridgeableNft,
  sender: string,
  receiver: string,
  direction: NftBridgeDirection,
  algod: Algodv2,
  indexer: Indexer
): Promise<algosdk.Transaction[]> {
  const params = normalizeSuggestedParams(await algod.getTransactionParams().do());
  const transferTxns = await buildArc72TransferBytes(
    nft.contractId,
    nft.tokenId,
    sender,
    algod,
    indexer
  );
  const note = encodeBridgeIntentNote({
    v: 1,
    dir: direction,
    receiver,
    sender,
    items: bridgeIntentItemsFromSelection([nft]),
  });
  /** 0 VOI payment — carries bridge intent note; fees are paid in VOI on Voi mainnet. */
  const registration = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: DORK_NFT_BRIDGE_ADDRESS,
    amount: 0n,
    note,
    suggestedParams: { ...params, flatFee: true, fee: 1000n },
  });
  const group = [...transferTxns, registration];
  if (group.length > ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP) {
    throw new Error("Bridge transaction group is too large for this NFT.");
  }
  algosdk.assignGroupID(group);
  return group;
}

async function buildAlgorandBridgeGroupForNft(
  nft: BridgeableNft,
  sender: string,
  receiver: string,
  direction: NftBridgeDirection,
  algod: Algodv2
): Promise<algosdk.Transaction[]> {
  const entry = getDorkNftByVoi(nft.contractId, Number(nft.tokenId));
  if (!entry) {
    throw new Error(`Unknown Dork ASA mapping for ${nft.name}.`);
  }
  const custody = bridgeCustodyAddress(direction);
  const params = normalizeSuggestedParams(await algod.getTransactionParams().do());
  const note = encodeBridgeIntentNote({
    v: 1,
    dir: direction,
    receiver,
    sender,
    items: bridgeIntentItemsFromSelection([nft]),
  });
  /** Algorand → Voi: ASA to DORKHJ (creator reserve, opted in to all Dork ASAs) with bridge note on the transfer. */
  const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender,
    receiver: custody,
    assetIndex: entry.assetId,
    amount: 1n,
    note,
    suggestedParams: { ...params, flatFee: true, fee: 2000n },
  });
  return [axfer];
}

export type NftBridgeSigningBundle = {
  unsignedFlat: Uint8Array[];
  groupSizes: number[];
  preparedGroups: Uint8Array[][];
  destAssetsForReceiver: { name: string; kind: "ASA" | "VSA"; lineKey: string }[];
};

export async function buildNftBridgeSigningBundle(args: {
  networkId: NetworkId;
  sender: string;
  receiver: string;
  selected: BridgeableNft[];
}): Promise<NftBridgeSigningBundle> {
  const { networkId, sender, receiver, selected } = args;
  if (selected.length === 0) {
    throw new Error("Select at least one NFT to bridge.");
  }
  if (!algosdk.isValidAddress(receiver)) {
    throw new Error("Enter a valid destination wallet address.");
  }

  const algoNet = getAlgorandNetworkFromNetworkId(networkId);
  if (!algoNet) {
    throw new Error("NFT bridge is only available on Voi or Algorand mainnet.");
  }

  const { algod, indexer } = await algorandService.initializeClientsForReads(algoNet);
  const direction = bridgeDirectionForNetwork(networkId);

  const atomicGroups: algosdk.Transaction[][] = [];
  for (const nft of selected) {
    if (direction === "voi-to-algorand") {
      atomicGroups.push(
        await buildVoiBridgeGroupForNft(nft, sender, receiver, direction, algod, indexer)
      );
    } else {
      atomicGroups.push(
        await buildAlgorandBridgeGroupForNft(nft, sender, receiver, direction, algod)
      );
    }
  }

  const preparedGroups = atomicGroups.map((group) =>
    group.map((txn) => algosdk.encodeUnsignedTransaction(txn))
  );
  const groupSizes = preparedGroups.map((g) => g.length);
  const unsignedFlat = preparedGroups.flat();

  const destAssetsForReceiver = selected.map((nft) => ({
    name: nft.name,
    kind: nft.destAssetLabel,
    lineKey: `${nft.contractId}-${nft.tokenId}`,
  }));

  return { unsignedFlat, groupSizes, preparedGroups, destAssetsForReceiver };
}

/** Flatten groups for wallet signing (same pattern as NFT drip claims). */
export function flattenBridgeGroupsForSigning(
  preparedGroups: Uint8Array[][]
): Pick<NftBridgeSigningBundle, "unsignedFlat" | "groupSizes" | "preparedGroups"> {
  const groupSizes = preparedGroups.map((g) => g.length);
  return {
    preparedGroups,
    groupSizes,
    unsignedFlat: preparedGroups.flat(),
  };
}

export type ParsedBridgeIntent = NftBridgeIntentPayload & {
  txId: string;
  round: number;
  /** Chain where the registration note was observed (user’s bridge source network). */
  sourceNetworkId: NetworkId;
  /** Account that received the registration note or tagged asset transfer. */
  custodyAddress: string;
};

async function fetchBridgeIntentsForAddress(
  networkId: NetworkId,
  custodyAddress: string,
  limit: number
): Promise<ParsedBridgeIntent[]> {
  const algoNet = getAlgorandNetworkFromNetworkId(networkId);
  if (!algoNet) return [];
  const { indexer } = await algorandService.initializeClientsForReads(algoNet);
  const prefix = new TextEncoder().encode(NFT_BRIDGE_NOTE_PREFIX);

  const response = indexer
    .searchForTransactions()
    .address(custodyAddress)
    .notePrefix(prefix)
    .limit(Math.min(limit, 100));

  const res = (await response.do()) as {
    transactions?: Array<{
      id?: string;
      ["confirmed-round"]?: number;
      transaction?: { note?: string };
    }>;
  };

  const out: ParsedBridgeIntent[] = [];
  for (const row of res.transactions ?? []) {
    const noteB64 = row.transaction?.note;
    if (!noteB64) continue;
    const noteBytes = Uint8Array.from(Buffer.from(noteB64, "base64"));
    const parsed = parseBridgeIntentNote(noteBytes);
    if (!parsed) continue;
    out.push({
      ...parsed,
      txId: row.id ?? "",
      round: row["confirmed-round"] ?? 0,
      sourceNetworkId: networkId,
      custodyAddress,
    });
  }
  return out;
}

export async function fetchPendingBridgeIntents(
  networkId: NetworkId,
  limit = 50
): Promise<ParsedBridgeIntent[]> {
  if (networkId !== "voi-mainnet" && networkId !== "algorand-mainnet") {
    return [];
  }
  const addresses = bridgeRegistrationLogAddresses(networkId);
  const batches = await Promise.all(
    addresses.map((addr) => fetchBridgeIntentsForAddress(networkId, addr, limit))
  );
  const byTx = new Map<string, ParsedBridgeIntent>();
  for (const row of batches.flat()) {
    if (row.txId && !byTx.has(row.txId)) {
      byTx.set(row.txId, row);
    }
  }
  return [...byTx.values()].sort((a, b) => b.round - a.round);
}
