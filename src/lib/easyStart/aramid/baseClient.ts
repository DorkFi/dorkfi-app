import {
  createPublicClient,
  fallback,
  http,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import {
  ARAMID_BASE_USDC,
  ARAMID_EVM_BRIDGE,
} from "@/lib/easyStart/aramid/constants";
import { ERC20_APPROVE_ABI } from "@/lib/easyStart/aramid/lockTokens";

const basePublicClient = createPublicClient({
  chain: base,
  transport: fallback([
    http("https://mainnet.base.org"),
    http("https://base.publicnode.com"),
  ]),
});

export async function fetchUsdcAllowance(
  owner: Address,
  spender: Address = ARAMID_EVM_BRIDGE
): Promise<bigint> {
  return basePublicClient.readContract({
    address: ARAMID_BASE_USDC,
    abi: ERC20_APPROVE_ABI,
    functionName: "allowance",
    args: [owner, spender],
  });
}

export async function waitForBaseTx(hash: Hex): Promise<void> {
  const receipt = await basePublicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
  });
  if (receipt.status !== "success") {
    throw new Error("Base transaction failed");
  }
}
