import { decodeAddress, encodeAddress } from "algosdk";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Decode a Bitcoin/Solana base58 string. Rejects ambiguous characters. */
export function decodeBase58(input: string): Uint8Array {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty base58 string");

  const bytes: number[] = [];
  for (const char of trimmed) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value < 0) throw new Error("Invalid base58 character");
    let carry = value;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  let zeros = 0;
  while (zeros < trimmed.length && trimmed[zeros] === "1") zeros += 1;

  const decoded = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    decoded[decoded.length - 1 - i] = bytes[i];
  }
  return decoded;
}

/**
 * Algorand address for a Solana embedded-wallet public key.
 * Dynamic Tier 2: the address is base32(pubkey ‖ checksum), no extra hash.
 */
export function deriveAlgorandAddressFromSolana(solanaAddress: string): string {
  const pubkey = decodeBase58(solanaAddress);
  if (pubkey.length !== 32) {
    throw new Error("Solana address must decode to 32 bytes");
  }
  return encodeAddress(pubkey);
}

export function canonicalAlgorandAddress(address: string): string {
  return encodeAddress(decodeAddress(address.trim()).publicKey);
}

export class AlgoOnrampBindError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AlgoOnrampBindError";
    this.status = status;
  }
}

/**
 * The Algorand destination must be the address derived from a Solana key
 * that Dynamic already put on the signed-in session.
 */
export function assertSolanaOwnsAlgorandAddress(args: {
  solanaAddress: string;
  algorandAddress: string;
  credentialValues: ReadonlySet<string>;
}): { solanaAddress: string; algorandAddress: string } {
  const solanaAddress = args.solanaAddress.trim();
  if (!solanaAddress || !args.credentialValues.has(solanaAddress)) {
    throw new AlgoOnrampBindError(
      403,
      "Solana wallet is not on this session. Sign out and back in after the wallet is created."
    );
  }

  let derived: string;
  try {
    derived = deriveAlgorandAddressFromSolana(solanaAddress);
  } catch {
    throw new AlgoOnrampBindError(400, "Solana address is not valid.");
  }

  let algorandAddress: string;
  try {
    algorandAddress = canonicalAlgorandAddress(args.algorandAddress);
  } catch {
    throw new AlgoOnrampBindError(400, "Algorand address is not valid.");
  }

  if (algorandAddress !== derived) {
    throw new AlgoOnrampBindError(
      403,
      "Algorand address does not match this Solana wallet."
    );
  }

  return { solanaAddress, algorandAddress };
}

/**
 * Coinbase ALGO must land on the xChain account owned by an EVM address
 * already on this session.
 */
export async function assertEvmOwnsXchainAddress(args: {
  evmAddresses: readonly string[];
  algorandAddress: string;
  derive: (evmAddress: string) => Promise<string>;
}): Promise<string> {
  const evmAddresses = args.evmAddresses
    .map((address) => address.trim())
    .filter((address) => address.length > 0);
  if (evmAddresses.length === 0) {
    throw new AlgoOnrampBindError(
      403,
      "EVM wallet is not on this session. Sign in again."
    );
  }

  let canonical: string;
  try {
    canonical = canonicalAlgorandAddress(args.algorandAddress);
  } catch {
    throw new AlgoOnrampBindError(400, "Algorand address is not valid.");
  }

  for (const evmAddress of evmAddresses) {
    let derived: string;
    try {
      derived = canonicalAlgorandAddress(await args.derive(evmAddress));
    } catch {
      continue;
    }
    if (derived === canonical) return canonical;
  }

  throw new AlgoOnrampBindError(
    403,
    "Algorand address does not match this account."
  );
}
