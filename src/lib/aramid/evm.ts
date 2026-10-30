import { encodeFunctionData, type Hex } from "viem";
import { NATIVE_ETH_TOKEN } from "@/lib/aramid/types";

export const ARAMID_EVM_BRIDGE =
  "0xC7FAA8f8C6D9Dc05ABf3C5aa741a38F9A6d1C263" as const;

const destinationTuple = [
  { name: "chainId", type: "uint32" },
  { name: "tokenId", type: "string" },
  { name: "amount", type: "uint256" },
  { name: "addressId", type: "string" },
] as const;

export const lockTokensAbi = [
  {
    type: "function",
    name: "lockTokens",
    stateMutability: "payable",
    inputs: [
      { name: "feeTokenAddr", type: "address" },
      { name: "feeAmount", type: "uint256" },
      { name: "rootTokenAddr", type: "address" },
      { name: "rootAmount", type: "uint256" },
      {
        name: "destinationChainData",
        type: "tuple",
        components: destinationTuple,
      },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const lockNativeCurrencyAbi = [
  {
    type: "function",
    name: "lockNativeCurrency",
    stateMutability: "payable",
    inputs: [
      { name: "feeTokenAddr", type: "address" },
      { name: "feeAmount", type: "uint256" },
      { name: "rootAmount", type: "uint256" },
      {
        name: "destinationChainData",
        type: "tuple",
        components: destinationTuple,
      },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const releaseTokensAbi = [
  {
    type: "function",
    name: "releaseTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "maxReleaseRound", type: "uint64" },
      { name: "sourceTransactionId", type: "string" },
      {
        name: "sourceChainData",
        type: "tuple",
        components: destinationTuple,
      },
      {
        name: "destinationChainData",
        type: "tuple",
        components: [
          { name: "chainId", type: "uint32" },
          { name: "tokenId", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "addressId", type: "address" },
        ],
      },
      { name: "note", type: "string" },
      { name: "signatures", type: "bytes[]" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type ExternalChainInfo = {
  chainId: number;
  tokenId: string;
  amount: bigint;
  addressId: string;
};

export function isNativeEthToken(tokenId: string): boolean {
  const id = tokenId.toLowerCase();
  return id === "0" || id === NATIVE_ETH_TOKEN;
}

export function encodeLockTokens(args: {
  token: `0x${string}`;
  feeAmount: bigint;
  rootAmount: bigint;
  destination: ExternalChainInfo;
  note: string;
}): Hex {
  return encodeFunctionData({
    abi: lockTokensAbi,
    functionName: "lockTokens",
    args: [
      args.token,
      args.feeAmount,
      args.token,
      args.rootAmount,
      {
        chainId: args.destination.chainId,
        tokenId: args.destination.tokenId,
        amount: args.destination.amount,
        addressId: args.destination.addressId,
      },
      args.note,
    ],
  });
}

export function encodeLockNative(args: {
  token: `0x${string}`;
  feeAmount: bigint;
  rootAmount: bigint;
  destination: ExternalChainInfo;
  note: string;
}): Hex {
  return encodeFunctionData({
    abi: lockNativeCurrencyAbi,
    functionName: "lockNativeCurrency",
    args: [
      args.token,
      args.feeAmount,
      args.rootAmount,
      {
        chainId: args.destination.chainId,
        tokenId: args.destination.tokenId,
        amount: args.destination.amount,
        addressId: args.destination.addressId,
      },
      args.note,
    ],
  });
}
