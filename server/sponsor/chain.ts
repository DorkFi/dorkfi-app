import { createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  Algodv2,
  makePaymentTxnWithSuggestedParamsFromObject,
  mnemonicToSecretKey,
  waitForConfirmation,
} from "algosdk";
import type { SponsorEnv } from "./env.ts";
import {
  spendableAlgoMicroAlgosFromAccount,
  sponsorPaymentFeeMicro,
  sponsorTreasuryShortfall,
} from "./spendable.ts";

export type SponsorChain = {
  deriveAlgorandAddress: (evmAddress: string) => Promise<string>;
  fetchEthBalanceWei: (evmAddress: string) => Promise<bigint>;
  fetchAlgoSpendableMicro: (algoAddress: string) => Promise<bigint>;
  sendEth: (to: string, amountWei: bigint) => Promise<string>;
  sendAlgo: (to: string, amountMicro: bigint) => Promise<string>;
};

let xchainSdk: {
  getAddress: (args: { evmAddress: string }) => Promise<string>;
} | null = null;
const deriveCache = new Map<string, string>();

async function getXchainSdk() {
  if (xchainSdk) return xchainSdk;
  const { AlgorandClient } = await import(
    "@algorandfoundation/algokit-utils/types/algorand-client"
  );
  const { AlgoXEvmSdk } = await import("algo-x-evm-sdk");
  xchainSdk = new AlgoXEvmSdk({ algorand: AlgorandClient.mainNet() });
  return xchainSdk;
}

export async function deriveAlgorandXchainAddress(
  evmAddress: string
): Promise<string> {
  const key = getAddress(evmAddress);
  const hit = deriveCache.get(key);
  if (hit) return hit;
  const sdk = await getXchainSdk();
  const addr = await sdk.getAddress({ evmAddress: key });
  deriveCache.set(key, addr);
  return addr;
}

function algodClient(env: SponsorEnv): Algodv2 {
  const url = new URL(
    env.algodUrl.includes("://") ? env.algodUrl : `https://${env.algodUrl}`
  );
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  return new Algodv2("", `${url.protocol}//${url.hostname}`, port);
}

function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const row = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  if (typeof row.status === "number") return row.status;
  if (typeof row.response?.status === "number") return row.response.status;
  return undefined;
}

export function createSponsorChain(env: SponsorEnv): SponsorChain {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(env.ethRpc),
  });

  return {
    deriveAlgorandAddress: deriveAlgorandXchainAddress,

    async fetchEthBalanceWei(evmAddress: string) {
      return publicClient.getBalance({ address: getAddress(evmAddress) });
    },

    async fetchAlgoSpendableMicro(algoAddress: string) {
      const algod = algodClient(env);
      try {
        const info = await algod.accountInformation(algoAddress).do();
        return spendableAlgoMicroAlgosFromAccount(
          info as {
            amount?: unknown;
            minBalance?: unknown;
            "min-balance"?: unknown;
          }
        );
      } catch (error) {
        const status = httpStatus(error);
        const message = error instanceof Error ? error.message : String(error);
        if (status === 404 || /not found|no such/i.test(message)) {
          return 0n;
        }
        throw error;
      }
    },

    async sendEth(to: string, amountWei: bigint) {
      if (!env.ethPrivateKey) {
        throw new Error("Sponsor ETH key is not configured");
      }
      const account = privateKeyToAccount(env.ethPrivateKey);
      const wallet = createWalletClient({
        account,
        chain: base,
        transport: http(env.ethRpc),
      });
      const hash = await wallet.sendTransaction({
        to: getAddress(to),
        value: amountWei,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },

    async sendAlgo(to: string, amountMicro: bigint) {
      if (!env.algoMnemonic) {
        throw new Error("Sponsor ALGO mnemonic is not configured");
      }
      const account = mnemonicToSecretKey(env.algoMnemonic);
      const algod = algodClient(env);
      const suggestedParams = await algod.getTransactionParams().do();
      const sender =
        typeof account.addr === "string"
          ? account.addr
          : account.addr.toString();
      const feeMicro = sponsorPaymentFeeMicro(suggestedParams);
      let treasurySpendable = 0n;
      try {
        const treasury = await algod.accountInformation(sender).do();
        treasurySpendable = spendableAlgoMicroAlgosFromAccount(
          treasury as {
            amount?: unknown;
            minBalance?: unknown;
            "min-balance"?: unknown;
          }
        );
      } catch (error) {
        const status = httpStatus(error);
        const message = error instanceof Error ? error.message : String(error);
        if (status !== 404 && !/not found|no such/i.test(message)) throw error;
      }
      const shortfall = sponsorTreasuryShortfall({
        spendableMicro: treasurySpendable,
        amountMicro,
        feeMicro,
      });
      if (shortfall) throw new Error(shortfall);
      const txn = makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: to,
        amount: amountMicro,
        suggestedParams,
      });
      const signed = txn.signTxn(account.sk);
      const { txid } = await algod.sendRawTransaction(signed).do();
      await waitForConfirmation(algod, txid, 8);
      return txid;
    },
  };
}
