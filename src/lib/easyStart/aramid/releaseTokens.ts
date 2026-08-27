import { encodeFunctionData, getAddress, type Address, type Hex } from "viem";
import type { AramidClaimData } from "@/lib/easyStart/aramid/claimData";

/** Live Base `releaseTokens` ABI (same selector as Aramid’s Vue claim page). */
export const ARAMID_RELEASE_TOKENS_ABI = [
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
        components: [
          { name: "chainId", type: "uint32" },
          { name: "tokenId", type: "string" },
          { name: "amount", type: "uint256" },
          { name: "addressId", type: "string" },
        ],
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

function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value);
}

function toHexBytes(value: string): Hex {
  const hex = value.startsWith("0x") ? value : `0x${value}`;
  return hex as Hex;
}

export function encodeAramidReleaseTokens(claim: AramidClaimData): Hex {
  return encodeFunctionData({
    abi: ARAMID_RELEASE_TOKENS_ABI,
    functionName: "releaseTokens",
    args: [
      BigInt(claim.maxClaimRound),
      claim.sourceTransactionId,
      {
        chainId: claim.sourceChainData.chainId,
        tokenId: String(claim.sourceChainData.tokenId),
        amount: toBigInt(claim.sourceChainData.amount),
        addressId: String(claim.sourceChainData.addressId),
      },
      {
        chainId: claim.destinationChainData.chainId,
        tokenId: getAddress(String(claim.destinationChainData.tokenId)) as Address,
        amount: toBigInt(claim.destinationChainData.amount),
        addressId: getAddress(
          String(claim.destinationChainData.addressId)
        ) as Address,
      },
      claim.note ?? "",
      claim.signatures.map(toHexBytes),
    ],
  });
}
