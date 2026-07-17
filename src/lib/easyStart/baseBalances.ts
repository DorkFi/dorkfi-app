import {
  createPublicClient,
  fallback,
  formatEther,
  formatUnits,
  http,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { Algodv2 } from "algosdk";
import { getAccountAssetHoldingAmountAtomic } from "@/utils/algodAccountAssetAmount";
import { spendableAlgoMicroAlgosFromAccount } from "@/utils/algorandWalletBalance";

/** Circle USDC on Base mainnet (Privy fundWallet / on-ramp destination). */
export const BASE_MAINNET_USDC =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/** Native USDC ASA on Algorand mainnet (Allbridge receive asset). */
export const ALGORAND_MAINNET_USDC_ASA = 31566704;
const ALGORAND_USDC_DECIMALS = 6;

const erc20BalanceOfAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/** Prefer explicit public Base RPCs over viem's default (often rate-limited). */
const basePublicClient = createPublicClient({
  chain: base,
  transport: fallback([
    http("https://mainnet.base.org"),
    http("https://base.publicnode.com"),
  ]),
});

/** Same mainnet algod as Easy Start bridge adapter (not app network-scoped). */
const ALGORAND_MAINNET_ALGOD = new Algodv2(
  "",
  "https://mainnet-api.4160.nodely.dev",
  "443"
);

/** ~enough for USDC approve + Allbridge send on Base with margin. */
export const MIN_BASE_ETH_WEI = 50_000_000_000_000n; // 0.00005 ETH

export async function fetchBaseEthBalance(address: Address): Promise<{
  value: bigint;
  formatted: string;
}> {
  const value = await basePublicClient.getBalance({ address });
  return { value, formatted: formatEther(value) };
}

export async function fetchBaseUsdcBalance(address: Address): Promise<{
  formatted: string;
  value: bigint;
}> {
  const [raw, decimals] = await Promise.all([
    basePublicClient.readContract({
      address: BASE_MAINNET_USDC,
      abi: erc20BalanceOfAbi,
      functionName: "balanceOf",
      args: [address],
    }),
    basePublicClient.readContract({
      address: BASE_MAINNET_USDC,
      abi: erc20BalanceOfAbi,
      functionName: "decimals",
    }),
  ]);
  return {
    value: raw,
    formatted: formatUnits(raw, decimals),
  };
}

/**
 * Algorand mainnet USDC (ASA 31566704) for an Easy Start xChain address.
 * Returns 0 when the account is not opted in or has no holding.
 */
export async function fetchAlgorandUsdcBalance(address: string): Promise<{
  formatted: string;
  value: bigint;
  optedIn: boolean;
}> {
  try {
    const info = await ALGORAND_MAINNET_ALGOD.accountAssetInformation(
      address,
      ALGORAND_MAINNET_USDC_ASA
    ).do();
    const atomic = getAccountAssetHoldingAmountAtomic(info) ?? 0n;
    return {
      value: atomic,
      formatted: formatUnits(atomic, ALGORAND_USDC_DECIMALS),
      optedIn: true,
    };
  } catch {
    // Not opted in / account missing asset → treat as zero available.
    return { value: 0n, formatted: "0", optedIn: false };
  }
}

export function hasEnoughBaseEth(balanceWei: bigint): boolean {
  return balanceWei >= MIN_BASE_ETH_WEI;
}

/** ~enough for Allbridge ALG→EVM group fees + MBR cushion (microAlgos). */
export const MIN_ALGORAND_ALGO_MICRO = 100_000n; // 0.1 ALGO

export async function fetchAlgorandAlgoBalance(address: string): Promise<{
  valueMicro: bigint;
  formatted: string;
}> {
  const info = await ALGORAND_MAINNET_ALGOD.accountInformation(address).do();
  const spendable = spendableAlgoMicroAlgosFromAccount(
    info as {
      amount?: unknown;
      minBalance?: unknown;
      "min-balance"?: unknown;
    }
  );
  return {
    valueMicro: spendable,
    formatted: formatUnits(spendable, 6),
  };
}

export function hasEnoughAlgorandAlgo(spendableMicro: bigint): boolean {
  return spendableMicro >= MIN_ALGORAND_ALGO_MICRO;
}
