/**
 * Proof that a connected Algorand wallet controls the buy address.
 * The wallet signs a 0 ALGO payment to itself. This process never broadcasts it.
 */
import { createHash } from "node:crypto";
import {
  TransactionType,
  decodeSignedTransaction,
} from "algosdk";
import nacl from "tweetnacl";

/** First line of the payment note. The client must use this exact string. */
export const ONRAMP_PROOF_PREFIX = "DorkFi Coinbase ALGO buy";

const MAX_TTL_MS = 15 * 60 * 1000;
const MAX_PROOF_CHARS = 4_000;

export function partnerUserRefFromAlgorandAddress(address: string): string {
  const digest = createHash("sha256").update(address).digest("hex").slice(0, 40);
  return `algo-${digest}`;
}

export function verifyAlgorandOnrampProof(
  signedB64: string,
  now = Date.now()
): string {
  const trimmed = signedB64.trim();
  if (!trimmed || trimmed.length > MAX_PROOF_CHARS) {
    throw new Error("Invalid wallet proof");
  }
  let bytes: Uint8Array;
  try {
    bytes = Buffer.from(trimmed, "base64");
  } catch {
    throw new Error("Invalid wallet proof");
  }
  if (bytes.length < 16) throw new Error("Invalid wallet proof");

  let signed;
  try {
    signed = decodeSignedTransaction(bytes);
  } catch {
    throw new Error("Invalid wallet proof");
  }
  if (!signed.sig || signed.msig || signed.lsig || signed.sgnr) {
    throw new Error("Wallet proof must be a single signature");
  }

  const txn = signed.txn;
  if (txn.type !== TransactionType.pay) {
    throw new Error("Wallet proof must be a payment");
  }
  if (txn.group?.length) throw new Error("Wallet proof cannot be grouped");
  if (txn.rekeyTo) throw new Error("Wallet proof cannot rekey");

  const pay = txn.payment;
  if (!pay || pay.amount !== 0n || pay.closeRemainderTo) {
    throw new Error("Wallet proof must be a zero-amount payment");
  }

  const sender = txn.sender.toString();
  if (pay.receiver.toString() !== sender) {
    throw new Error("Wallet proof must pay the same account");
  }

  const note = new TextDecoder().decode(txn.note ?? new Uint8Array());
  const [prefix, expiryRaw, notedAddress] = note.split("\n");
  if (prefix !== ONRAMP_PROOF_PREFIX || notedAddress !== sender) {
    throw new Error("Wallet proof note is not a DorkFi buy challenge");
  }
  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + MAX_TTL_MS) {
    throw new Error("Wallet proof expired");
  }

  const ok = nacl.sign.detached.verify(
    txn.bytesToSign(),
    signed.sig,
    txn.sender.publicKey
  );
  if (!ok) throw new Error("Wallet proof signature is invalid");
  return sender;
}
