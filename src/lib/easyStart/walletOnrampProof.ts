import {
  Algodv2,
  makePaymentTxnWithSuggestedParamsFromObject,
} from "algosdk";

/** Must match `ONRAMP_PROOF_PREFIX` in server/offramp/walletProof.ts. */
const ONRAMP_PROOF_PREFIX = "DorkFi Coinbase ALGO buy";

const ALGOD = new Algodv2("", "https://mainnet-api.4160.nodely.dev", "443");

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Ask the connected wallet to sign a 0 ALGO payment to itself.
 * The signed bytes are the Coinbase session proof. They are not broadcast.
 */
export async function signAlgorandOnrampProof(
  address: string,
  signTransactions: (txns: Uint8Array[]) => Promise<(Uint8Array | null)[]>
): Promise<string> {
  const params = await ALGOD.getTransactionParams().do();
  const expiry = Date.now() + 10 * 60 * 1000;
  const note = new TextEncoder().encode(
    `${ONRAMP_PROOF_PREFIX}\n${expiry}\n${address}`
  );
  const txn = makePaymentTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    note,
    suggestedParams: params,
  });
  const signed = await signTransactions([txn.toByte()]);
  const blob = signed[0];
  if (!blob || blob.length === 0) {
    throw new Error("Wallet did not return a signature");
  }
  return bytesToBase64(blob);
}
