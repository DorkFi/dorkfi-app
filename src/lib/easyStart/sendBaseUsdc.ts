import { encodeFunctionData, parseUnits, type Hex } from "viem";
import { base } from "viem/chains";
import { BASE_MAINNET_USDC } from "@/lib/easyStart/baseBalances";

const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type SendUsdcFn = (input: {
  to: string;
  value?: bigint;
  data?: Hex;
  chainId?: number;
}) => Promise<{ hash: Hex }>;

/** Build + send USDC transfer on Base via Privy `useSendTransaction`. */
export async function sendBaseUsdc(args: {
  sendTransaction: SendUsdcFn;
  to: string;
  /** Human USDC amount, e.g. "18.5" */
  amount: string;
  fromAddress?: string;
}): Promise<Hex> {
  const to = args.to as `0x${string}`;
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new Error("Invalid deposit address");
  }
  const amount = Number(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid USDC amount");
  }
  const units = parseUnits(
    amount.toFixed(6).replace(/\.?0+$/, "") || String(amount),
    6
  );
  const data = encodeFunctionData({
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [to, units],
  });

  const { hash } = await args.sendTransaction({
    to: BASE_MAINNET_USDC,
    data,
    value: 0n,
    chainId: base.id,
  });
  return hash;
}
