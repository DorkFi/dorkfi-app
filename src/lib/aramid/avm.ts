import {
  Algodv2,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  type Transaction,
} from "algosdk";
import { ARAMID_CHAIN, type AramidChainId } from "@/lib/aramid/types";

const ALGOD: Record<number, Algodv2> = {
  [ARAMID_CHAIN.algorand]: new Algodv2(
    "",
    "https://mainnet-api.4160.nodely.dev",
    "443"
  ),
  [ARAMID_CHAIN.voi]: new Algodv2(
    "",
    "https://mainnet-api.voi.nodely.dev",
    "443"
  ),
};

export function avmAlgod(chainId: AramidChainId): Algodv2 {
  const client = ALGOD[chainId];
  if (!client) throw new Error("That network is not an Algorand-family chain.");
  return client;
}

export type AramidTransferNote = {
  destinationNetwork: number;
  destinationAddress: string;
  destinationToken: string;
  feeAmount: string;
  sourceAmount: string;
  destinationAmount: string;
  note: string;
};

/** Whole base-unit amount, written as a JSON number (no quotes). */
function jsonUint(value: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error("Bridge amount is not a whole number of base units.");
  }
  return value.replace(/^0+(?=\d)/, "");
}

export function aramidTransferNote(payload: AramidTransferNote): Uint8Array {
  // Aramid's app parseInt's the amounts, then JSON.stringify's this key order.
  // Quoted amounts stay pending because the processors never confirm them.
  const body = [
    `{"destinationNetwork":${payload.destinationNetwork}`,
    `"destinationAddress":${JSON.stringify(payload.destinationAddress)}`,
    `"destinationToken":${JSON.stringify(payload.destinationToken)}`,
    `"feeAmount":${jsonUint(payload.feeAmount)}`,
    `"destinationAmount":${jsonUint(payload.destinationAmount)}`,
    `"note":${JSON.stringify(payload.note)}`,
    `"sourceAmount":${jsonUint(payload.sourceAmount)}}`,
  ].join(",");
  return new TextEncoder().encode(`aramid-transfer/v1:j${body}`);
}

export async function buildAvmBridgeTxn(args: {
  chainId: AramidChainId;
  from: string;
  bridgeAddress: string;
  assetId: number;
  totalAmount: bigint;
  note: Uint8Array;
}): Promise<Transaction> {
  const suggestedParams = await avmAlgod(args.chainId)
    .getTransactionParams()
    .do();
  if (args.assetId > 0) {
    return makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: args.from,
      receiver: args.bridgeAddress,
      assetIndex: args.assetId,
      amount: args.totalAmount,
      note: args.note,
      suggestedParams,
    });
  }
  return makePaymentTxnWithSuggestedParamsFromObject({
    sender: args.from,
    receiver: args.bridgeAddress,
    amount: args.totalAmount,
    note: args.note,
    suggestedParams,
  });
}

export async function buildAlgorandOptInTxn(args: {
  from: string;
  assetId: number;
}): Promise<Transaction> {
  const suggestedParams = await avmAlgod(ARAMID_CHAIN.algorand)
    .getTransactionParams()
    .do();
  return makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: args.from,
    receiver: args.from,
    assetIndex: args.assetId,
    amount: 0,
    suggestedParams,
  });
}
