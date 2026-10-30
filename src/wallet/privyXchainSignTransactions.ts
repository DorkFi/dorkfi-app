import { AlgorandClient } from "@algorandfoundation/algokit-utils/types/algorand-client";
import algosdk, { type Transaction } from "algosdk";
import {
  AlgoXEvmSdk,
  type SignTypedDataParams as AlgoXSignTypedDataParams,
} from "algo-x-evm-sdk";

export type PrivySignTypedDataFn = (
  input: AlgoXSignTypedDataParams,
  options?: { address?: string }
) => Promise<{ signature: string }>;

let cachedSdk: AlgoXEvmSdk | null = null;

function getSdk(): AlgoXEvmSdk {
  if (!cachedSdk) {
    cachedSdk = new AlgoXEvmSdk({
      algorand: AlgorandClient.mainNet(),
    });
  }
  return cachedSdk;
}

/**
 * Sign unsigned Algorand txn blobs with a Privy embedded EVM wallet (xChain EIP-712).
 * Matches the drop-in shape of `useWallet().signTransactions`.
 */
export async function signPrivyXchainTransactions(
  evmAddress: string,
  unsignedTxnBlobs: Uint8Array[],
  signTypedData: PrivySignTypedDataFn
): Promise<Uint8Array[]> {
  if (!unsignedTxnBlobs.length) {
    throw new Error("No transactions to sign");
  }

  const txns = unsignedTxnBlobs.map((blob) =>
    algosdk.decodeUnsignedTransaction(blob)
  );

  return getSdk().signTxn({
    evmAddress,
    txns,
    signMessage: (typedData) =>
      signTypedDataForXchain(evmAddress, typedData, signTypedData),
  });
}

/**
 * Sign a Haystack group with the embedded EVM wallet.
 * The EIP-712 payload is the atomic group id when the group has more than one
 * transaction. Callers must pass the full group, not a sliced subset.
 */
export async function signXchainTransactionGroup(
  evmAddress: string,
  txnGroup: Transaction[],
  indexesToSign: number[],
  signTypedData: PrivySignTypedDataFn
): Promise<(Uint8Array | null)[]> {
  const { signer } = await getSdk().getSigner({
    evmAddress,
    signMessage: (typedData) =>
      signTypedDataForXchain(evmAddress, typedData, signTypedData),
  });
  return signer(txnGroup, indexesToSign);
}

async function signTypedDataForXchain(
  evmAddress: string,
  typedData: AlgoXSignTypedDataParams,
  signTypedData: PrivySignTypedDataFn
): Promise<string> {
  const { signature } = await signTypedData(
    {
      ...typedData,
      types: {
        ...typedData.types,
        EIP712Domain: [...typedData.types.EIP712Domain],
        "Algorand Transaction": [...typedData.types["Algorand Transaction"]],
      },
    },
    { address: evmAddress }
  );
  return signature;
}
