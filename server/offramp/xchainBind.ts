import { decodeAddress } from "algosdk";
import { AuthError } from "./privyAuth.ts";
import { deriveAlgorandXchainAddress } from "../sponsor/chain.ts";

export function isAlgorandAddress(address: string): boolean {
  try {
    decodeAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * The Coinbase ALGO destination must be the xChain account of an EVM address
 * linked to this Privy user. Derivation is deterministic from the embedded key.
 */
export async function assertPrivyOwnsXchainAddress(
  evmAddresses: string[],
  algorandAddress: string
): Promise<void> {
  if (!isAlgorandAddress(algorandAddress)) {
    throw new AuthError(400, "Valid Algorand address required");
  }
  const owners = evmAddresses.filter((value) =>
    /^0x[0-9a-fA-F]{40}$/.test(value)
  );
  if (owners.length === 0) {
    throw new AuthError(403, "Could not confirm the wallet on this session.");
  }
  for (const evmAddress of owners) {
    const derived = await deriveAlgorandXchainAddress(evmAddress);
    if (derived === algorandAddress) return;
  }
  throw new AuthError(
    403,
    "Algorand account is not derived from this wallet"
  );
}
