import { encodeFunctionData, type Hex } from "viem";
import {
  ARAMID_ALGORAND_CHAIN_ID,
  ARAMID_ALGORAND_USDC_TOKEN_ID,
  ARAMID_BASE_USDC,
  ARAMID_NOTE,
} from "@/lib/easyStart/aramid/constants";

/** Working `lockTokens` ABI from live Base Aramid integrations. */
export const ARAMID_LOCK_TOKENS_ABI = [
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
        components: [
          { name: "chainId", type: "uint32" },
          { name: "tokenId", type: "string" },
          { name: "amount", type: "uint256" },
          { name: "addressId", type: "string" },
        ],
      },
      { name: "note", type: "string" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function encodeAramidLockTokens(args: {
  feeAmount: bigint;
  rootAmount: bigint;
  algorandAddress: string;
}): Hex {
  return encodeFunctionData({
    abi: ARAMID_LOCK_TOKENS_ABI,
    functionName: "lockTokens",
    args: [
      ARAMID_BASE_USDC,
      args.feeAmount,
      ARAMID_BASE_USDC,
      args.rootAmount,
      {
        chainId: ARAMID_ALGORAND_CHAIN_ID,
        tokenId: ARAMID_ALGORAND_USDC_TOKEN_ID,
        amount: args.rootAmount,
        addressId: args.algorandAddress,
      },
      ARAMID_NOTE,
    ],
  });
}

export function encodeUsdcApprove(spender: `0x${string}`, value: bigint): Hex {
  return encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spender, value],
  });
}
