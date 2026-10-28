import algosdk, { type Transaction } from "algosdk";
import { signMessage, type WalletAccount } from "@dynamic-labs-sdk/client";
import { dynamicClient } from "@/dynamic/dynamicClient";
import { deriveAlgorandAddressFromSolana } from "@/lib/easyStart/algorandFromSolana";
import {
  bytesToHex,
  signAlgorandGroupWithEd25519,
  signatureToBytes,
} from "@/wallet/algorandGroupSign";

/**
 * Sign the Haystack group with the Dynamic Solana key that owns the account.
 *
 * Each transaction's `bytesToSign()` already commits to the atomic group id.
 * Dynamic's ed25519 message signer hex-decodes the string and signs those
 * bytes. `signSerializedTransaction` parses a Solana transaction instead, so
 * Algorand bytes fail before a prompt.
 */
export async function signEasyStartAlgorandGroup(args: {
  walletAccount: WalletAccount;
  signerAddress: string;
  txnGroup: Transaction[];
  indexesToSign: number[];
}): Promise<Uint8Array[]> {
  assertSolanaWalletOwnsAccount(args.walletAccount, args.signerAddress);
  if (!dynamicClient) {
    throw new Error("Easy Start isn’t available.");
  }

  const client = dynamicClient;
  return signAlgorandGroupWithEd25519({
    signerAddress: args.signerAddress,
    txnGroup: args.txnGroup,
    indexesToSign: args.indexesToSign,
    signBytes: async (message) => {
      const { signature } = await signMessage(
        {
          walletAccount: args.walletAccount,
          message: bytesToHex(message),
        },
        client
      );
      return signatureToBytes(signature);
    },
  });
}

function assertSolanaWalletOwnsAccount(
  walletAccount: WalletAccount,
  signerAddress: string
) {
  if (walletAccount.chain !== "SOL") {
    throw new Error(
      "Swap signing needs the Solana wallet that owns this Algorand account."
    );
  }

  let derived: string;
  let canonical: string;
  try {
    derived = deriveAlgorandAddressFromSolana(walletAccount.address);
    canonical = algosdk.encodeAddress(
      algosdk.decodeAddress(signerAddress).publicKey
    );
  } catch {
    throw new Error("This Solana wallet cannot sign for the Algorand account.");
  }

  if (derived !== canonical) {
    throw new Error(
      "This Solana wallet does not own the Algorand account being swapped."
    );
  }
}
