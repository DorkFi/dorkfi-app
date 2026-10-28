import algosdk, { type Transaction } from "algosdk";
import nacl from "tweetnacl";
import { decodeBase58 } from "@/lib/easyStart/algorandFromSolana";

/**
 * Sign selected transactions from an atomic group.
 *
 * `bytesToSign()` already commits to the group id, so callers must pass the
 * full group. A signature over a transaction that was pulled out of the group
 * will not verify.
 */
export async function signAlgorandGroupWithEd25519(args: {
  signerAddress: string;
  txnGroup: Transaction[];
  indexesToSign: number[];
  signBytes: (message: Uint8Array) => Promise<Uint8Array>;
}): Promise<Uint8Array[]> {
  const signed: Uint8Array[] = [];
  for (const index of args.indexesToSign) {
    const txn = args.txnGroup[index];
    if (!txn) {
      throw new Error(`Missing swap transaction at index ${index}`);
    }
    const message = txn.bytesToSign();
    const signature = await args.signBytes(message);
    assertSignatureMatches(message, signature, args.signerAddress);
    signed.push(txn.attachSignature(args.signerAddress, signature));
  }
  return signed;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function signatureHexToBytes(signature: string): Uint8Array {
  const normalized = signature.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length !== 128) {
    throw new Error("Wallet returned an unexpected signature.");
  }
  const out = new Uint8Array(64);
  for (let i = 0; i < 64; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Dynamic returns the ed25519 signature as hex or base58. */
export function signatureToBytes(signature: string): Uint8Array {
  const trimmed = signature.trim();
  const hexBody = trimmed.replace(/^0x/i, "");
  if (/^[0-9a-fA-F]{128}$/.test(hexBody)) {
    return signatureHexToBytes(trimmed);
  }
  try {
    const decoded = decodeBase58(trimmed);
    if (decoded.length === 64) return decoded;
  } catch {
    // Fall through to the shared error below.
  }
  throw new Error("Wallet returned an unexpected signature.");
}

function assertSignatureMatches(
  message: Uint8Array,
  signature: Uint8Array,
  signerAddress: string
) {
  const publicKey = algosdk.decodeAddress(signerAddress).publicKey;
  if (
    signature.length !== 64 ||
    !nacl.sign.detached.verify(message, signature, publicKey)
  ) {
    throw new Error("The wallet signature does not match this Algorand account.");
  }
}
