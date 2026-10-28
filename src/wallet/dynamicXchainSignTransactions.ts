import type { EvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import type { WalletClient } from "viem";
import type { Transaction } from "algosdk";
import {
  signPrivyXchainTransactions,
  signXchainTransactionGroup,
  type PrivySignTypedDataFn,
} from "@/wallet/privyXchainSignTransactions";

export async function getDynamicWalletClient(
  walletAccount: EvmWalletAccount
): Promise<WalletClient> {
  return createWalletClientForWalletAccount({ walletAccount });
}

/** EIP-712 signer for algo-x-evm-sdk. Strips EIP712Domain; viem rebuilds it. */
export function dynamicSignTypedData(
  getClient: () => Promise<WalletClient>
): PrivySignTypedDataFn {
  return async (typedData) => {
    const walletClient = await getClient();
    const { EIP712Domain: _domainType, ...types } = typedData.types;
    const signature = await walletClient.signTypedData({
      account: walletClient.account,
      domain: typedData.domain,
      types,
      primaryType: typedData.primaryType,
      message: typedData.message,
    } as Parameters<WalletClient["signTypedData"]>[0]);
    return { signature };
  };
}

export async function signDynamicXchainTransactions(
  evmAddress: string,
  unsignedTxnBlobs: Uint8Array[],
  getClient: () => Promise<WalletClient>
): Promise<Uint8Array[]> {
  return signPrivyXchainTransactions(
    evmAddress,
    unsignedTxnBlobs,
    dynamicSignTypedData(getClient)
  );
}

/** Haystack signer: full atomic group, one EIP-712 prompt from the EVM wallet. */
export async function signDynamicXchainGroup(
  evmAddress: string,
  txnGroup: Transaction[],
  indexesToSign: number[],
  getClient: () => Promise<WalletClient>
): Promise<Uint8Array[]> {
  return signXchainTransactionGroup(
    evmAddress,
    txnGroup,
    indexesToSign,
    dynamicSignTypedData(getClient)
  );
}
