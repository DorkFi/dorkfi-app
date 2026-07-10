import { AlgorandClient } from "@algorandfoundation/algokit-utils/types/algorand-client";
import { AlgoXEvmSdk } from "algo-x-evm-sdk";
import { getAddress as normalizeEvmAddress } from "viem";

let cachedSdk: AlgoXEvmSdk | null = null;

function getXchainSdk(): AlgoXEvmSdk {
  if (!cachedSdk) {
    cachedSdk = new AlgoXEvmSdk({
      algorand: AlgorandClient.mainNet(),
    });
  }
  return cachedSdk;
}

/**
 * Derive the Algorand xChain LogicSig address for an EVM wallet owner.
 * Compiles TEAL via algod (cached per EVM address in the SDK instance).
 */
export async function deriveAlgorandXchainAddress(
  evmAddress: string
): Promise<string> {
  const checksummed = normalizeEvmAddress(evmAddress);
  return getXchainSdk().getAddress({ evmAddress: checksummed });
}
