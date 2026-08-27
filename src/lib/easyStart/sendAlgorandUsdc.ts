import algosdk, { Algodv2, waitForConfirmation } from "algosdk";
import { requireAlgorandAddressString } from "@/lib/algorand/addressString";
import {
  ALGORAND_MAINNET_USDC_ASA,
  fetchAlgorandUsdcBalance,
} from "@/lib/easyStart/baseBalances";

const ALGORAND_MAINNET_ALGOD = new Algodv2(
  "",
  "https://mainnet-api.4160.nodely.dev",
  "443"
);

function parseUsdcAtomic(amountHuman: string): bigint {
  const n = Number(amountHuman);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Invalid USDC amount");
  }
  // 6 decimals; avoid float drift for typical UI amounts
  return BigInt(Math.round(n * 1_000_000));
}

export type SignAlgorandTxns = (
  txns: Uint8Array[]
) => Promise<Uint8Array[]>;

async function signAndSend(
  unsigned: Uint8Array[],
  signTransactions: SignAlgorandTxns
): Promise<string> {
  const signed = await signTransactions(unsigned);
  const { txid } = await ALGORAND_MAINNET_ALGOD.sendRawTransaction(signed).do();
  await waitForConfirmation(ALGORAND_MAINNET_ALGOD, txid, 8);
  return txid;
}

/** Opt the Algorand account into native USDC (ASA 31566704) if needed. */
export async function ensureAlgorandUsdcOptIn(args: {
  address: string;
  signTransactions: SignAlgorandTxns;
}): Promise<{ alreadyOptedIn: boolean; txId?: string }> {
  const bal = await fetchAlgorandUsdcBalance(args.address);
  if (bal.optedIn) return { alreadyOptedIn: true };

  const address = requireAlgorandAddressString(args.address);
  const sp = await ALGORAND_MAINNET_ALGOD.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    assetIndex: ALGORAND_MAINNET_USDC_ASA,
    suggestedParams: sp,
  });
  const txId = await signAndSend(
    [txn.toByte()],
    args.signTransactions
  );
  return { alreadyOptedIn: false, txId };
}

/** Send Algorand mainnet USDC (ASA 31566704) from Easy Start xChain address. */
export async function sendAlgorandUsdc(args: {
  from: string;
  to: string;
  /** Human USDC amount, e.g. "18.5" */
  amount: string;
  signTransactions: SignAlgorandTxns;
  /** Optional note (Aramid AVM → EVM transfers). */
  note?: Uint8Array;
}): Promise<string> {
  const atomic = parseUsdcAtomic(args.amount);
  const sp = await ALGORAND_MAINNET_ALGOD.getTransactionParams().do();
  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: requireAlgorandAddressString(args.from, "sender"),
    receiver: requireAlgorandAddressString(args.to, "receiver"),
    amount: atomic,
    assetIndex: ALGORAND_MAINNET_USDC_ASA,
    suggestedParams: sp,
    note: args.note,
  });
  return signAndSend([txn.toByte()], args.signTransactions);
}
