import algosdk, { type Algodv2, type Indexer } from "algosdk";
import type { NetworkId } from "@/config";
import { getAlgorandNetworkFromNetworkId } from "@/config";
import {
  DORK_NFT_ALGORAND_RESERVE_ADDRESS,
  DORK_NFT_BRIDGE_ADDRESS,
  NFT_BRIDGE_NOTE_PREFIX,
  type NftBridgeDirection,
  type NftBridgeIntentItem,
  type NftBridgeIntentPayload,
} from "@/config/nftBridge";
import { getDorkNftByAssetId, getDorkNftByVoi } from "@/data/dorkNftAlgorandRegistry";
import type { UserNFT } from "@/hooks/useUserNFTs";
import { groupTransactions } from "@/lib/algorand/grouping";
import { ALGORAND_MAX_TXNS_PER_ATOMIC_GROUP } from "@/services/nftDripClaimService";
import algorandService from "@/services/algorandService";

export type BridgeableNft = UserNFT & {
  sourceId: string;
  destAssetId: string;
  destAssetLabel: string;
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
    if (direction === "voi-to-algorand") {
      out.push({
        ...nft,
        sourceId: `arc72:${nft.contractId}:${nft.tokenId}`,
        destAssetId: String(entry.assetId),
        destAssetLabel: `ASA ${entry.assetId}`,
      });
    } else {
      out.push({
        ...nft,
        sourceId: String(entry.assetId),
        destAssetId: `${entry.voiContractId}:${entry.voiTokenId}`,
        destAssetLabel: `arc72:${entry.voiContractId}:${entry.voiTokenId}`,
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
  const params = normalizeSuggestedParams(await algod.getTransactionParams().do());
  const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender,
    receiver: DORK_NFT_BRIDGE_ADDRESS,
    assetIndex: entry.assetId,
    amount: 1n,
    suggestedParams: { ...params, flatFee: true, fee: 2000n },
  });
  const note = encodeBridgeIntentNote({
    v: 1,
    dir: direction,
    receiver,
    sender,
    items: bridgeIntentItemsFromSelection([nft]),
  });
  const registration = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: DORK_NFT_BRIDGE_ADDRESS,
    amount: 0n,
    note,
    suggestedParams: { ...params, flatFee: true, fee: 1000n },
  });
  const group = [axfer, registration];
  algosdk.assignGroupID(group);
  return group;
}

export type NftBridgeSigningBundle = {
  unsignedFlat: Uint8Array[];
  groupSizes: number[];
  preparedGroups: Uint8Array[][];
  destAssetsForReceiver: { name: string; assetId: string }[];
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

  const destAssetsForReceiver =
    direction === "voi-to-algorand"
      ? selected.map((nft) => ({ name: nft.name, assetId: nft.destAssetId }))
      : selected.map((nft) => ({
          name: nft.name,
          assetId: nft.destAssetLabel,
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
};

export async function fetchPendingBridgeIntents(
  networkId: NetworkId,
  limit = 50
): Promise<ParsedBridgeIntent[]> {
  const algoNet = getAlgorandNetworkFromNetworkId(networkId);
  if (!algoNet) return [];
  const { indexer } = await algorandService.initializeClientsForReads(algoNet);
  const prefix = new TextEncoder().encode(NFT_BRIDGE_NOTE_PREFIX);

  const response = indexer
    .searchForTransactions()
    .address(DORK_NFT_BRIDGE_ADDRESS)
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
    });
  }
  return out;
}

/** Operator release: Voi → Algorand sends ASA from DORKHJ reserve to the receiver. */
async function buildAlgorandReleaseGroup(
  assetId: number,
  receiver: string,
  reserveSender: string,
  algod: Algodv2
): Promise<algosdk.Transaction[]> {
  const params = normalizeSuggestedParams(await algod.getTransactionParams().do());
  const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: reserveSender,
    receiver,
    assetIndex: assetId,
    amount: 1n,
    suggestedParams: { ...params, flatFee: true, fee: 2000n },
  });
  return [axfer];
}

export async function buildBridgeReleaseSigningBundle(args: {
  networkId: NetworkId;
  operatorAddress: string;
  intent: NftBridgeIntentPayload;
  item: NftBridgeIntentItem;
}): Promise<Uint8Array[][]> {
  const { networkId, operatorAddress, intent, item } = args;
  const algoNet = getAlgorandNetworkFromNetworkId(networkId);
  if (!algoNet) throw new Error("Unsupported network.");

  const { algod, indexer } = await algorandService.initializeClientsForReads(algoNet);
  let txns: algosdk.Transaction[] = [];

  if (intent.dir === "voi-to-algorand") {
    if (
      operatorAddress.toUpperCase() !== DORK_NFT_ALGORAND_RESERVE_ADDRESS.toUpperCase()
    ) {
      throw new Error("Connect the DORKHJ reserve wallet on Algorand to release.");
    }
    const assetId = Number(item.destAssetId);
    if (!Number.isFinite(assetId)) throw new Error("Invalid destination ASA id.");
    txns = await buildAlgorandReleaseGroup(
      assetId,
      intent.receiver,
      operatorAddress,
      algod
    );
  } else {
    if (operatorAddress.toUpperCase() !== DORK_NFT_BRIDGE_ADDRESS.toUpperCase()) {
      throw new Error("Connect the DEVOUR wallet on Voi to release.");
    }
    const entry =
      getDorkNftByAssetId(Number(item.sourceId)) ??
      getDorkNftByVoi(
        Number(item.destAssetId.split(":")[0]),
        Number(item.destAssetId.split(":")[1])
      );
    if (!entry) throw new Error("Could not resolve Voi NFT for release.");
    const Arc72 = (await import("ulujs/impl/arc72/index.js")).default;
    const contract = new Arc72(entry.voiContractId, algod, indexer, {
      simulate: true,
      acc: { addr: operatorAddress },
    });
    const result = await contract.arc72_transferFrom(
      operatorAddress,
      intent.receiver,
      BigInt(entry.voiTokenId),
      true,
      false
    );
    if (!result?.success || !Array.isArray(result.txns)) {
      throw new Error("Could not build Voi release transfer.");
    }
    txns = (result.txns as string[]).map((b64) =>
      algosdk.decodeUnsignedTransaction(
        Uint8Array.from(Buffer.from(b64, "base64"))
      )
    );
  }

  const groups = groupTransactions(txns);
  return groups.map((group) =>
    group.map((txn) => algosdk.encodeUnsignedTransaction(txn))
  );
}
