import {
  Algodv2,
  decodeAddress,
  makePaymentTxnWithSuggestedParamsFromObject,
  waitForConfirmation,
} from "algosdk";
import { spendableAlgoMicroAlgosFromAccount } from "@/utils/algorandWalletBalance";
import type { SignAlgorandTxns } from "@/lib/easyStart/sendAlgorandUsdc";

const ALGORAND_MAINNET_ALGOD = new Algodv2(
  "",
  "https://mainnet-api.4160.nodely.dev",
  "443"
);

/** Minimum balance a brand-new Algorand account must receive. */
const NEW_ACCOUNT_MIN_MICRO = 100_000n;

export function isAlgorandAddress(address: string): boolean {
  try {
    decodeAddress(address.trim());
    return true;
  } catch {
    return false;
  }
}

function parseAlgoMicro(amountHuman: string): bigint {
  const n = Number(amountHuman);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Enter an ALGO amount.");
  }
  return BigInt(Math.round(n * 1_000_000));
}

function isMissingAccount(error: unknown): boolean {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: number }).status)
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return status === 404 || message.includes("404");
}

/** Send native ALGO from the Easy Start xChain account. */
export async function sendAlgorandAlgo(args: {
  from: string;
  to: string;
  /** Human ALGO amount, e.g. "10.5" */
  amount: string;
  signTransactions: SignAlgorandTxns;
}): Promise<string> {
  const from = args.from.trim();
  const to = args.to.trim();
  if (!isAlgorandAddress(from) || !isAlgorandAddress(to)) {
    throw new Error("Enter a valid Algorand address.");
  }
  if (from === to) {
    throw new Error("Choose a different Algorand address.");
  }

  const atomic = parseAlgoMicro(args.amount);
  const senderInfo = await ALGORAND_MAINNET_ALGOD.accountInformation(from).do();
  const spendable = spendableAlgoMicroAlgosFromAccount(
    senderInfo as {
      amount?: unknown;
      minBalance?: unknown;
      "min-balance"?: unknown;
    }
  );

  try {
    await ALGORAND_MAINNET_ALGOD.accountInformation(to).do();
  } catch (error) {
    if (!isMissingAccount(error)) throw error;
    if (atomic < NEW_ACCOUNT_MIN_MICRO) {
      throw new Error("A new Algorand account needs at least 0.1 ALGO.");
    }
  }

  const suggestedParams = await ALGORAND_MAINNET_ALGOD.getTransactionParams().do();
  const txn = makePaymentTxnWithSuggestedParamsFromObject({
    sender: from,
    receiver: to,
    amount: atomic,
    suggestedParams,
  });
  const feeRaw = txn.fee ?? suggestedParams.minFee ?? 1000;
  const fee = typeof feeRaw === "bigint" ? feeRaw : BigInt(feeRaw);
  if (atomic + fee > spendable) {
    throw new Error(
      "That amount leaves nothing for the network fee and the account minimum."
    );
  }

  const signed = await args.signTransactions([txn.toByte()]);
  const { txid } = await ALGORAND_MAINNET_ALGOD.sendRawTransaction(signed).do();
  await waitForConfirmation(ALGORAND_MAINNET_ALGOD, txid, 8);
  return txid;
}
