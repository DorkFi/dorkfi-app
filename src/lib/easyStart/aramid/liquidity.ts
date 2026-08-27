import type { Address } from "viem";
import {
  ARAMID_EVM_BRIDGE,
} from "@/lib/easyStart/aramid/constants";
import {
  fetchBaseEthBalance,
  fetchBaseUsdcBalance,
} from "@/lib/easyStart/baseBalances";

/** Bridge needs a little ETH to submit the Base release. */
const MIN_BRIDGE_ETH_WEI = 10_000_000_000_000n; // 0.00001 ETH

export async function fetchAramidBaseUsdcReserve(): Promise<bigint> {
  return (await fetchBaseUsdcBalance(ARAMID_EVM_BRIDGE as Address)).value;
}

export async function fetchAramidBaseEthReserve(): Promise<bigint> {
  return (await fetchBaseEthBalance(ARAMID_EVM_BRIDGE as Address)).value;
}

/**
 * Soldiers cannot release on Base if the bridge wallet is short USDC (or ETH gas).
 * Call before locking funds on Algorand.
 */
export async function assertAramidBaseCanRelease(args: {
  destinationAtomic: bigint;
  consumerCopy?: boolean;
}): Promise<void> {
  if (args.destinationAtomic <= 0n) {
    throw new Error("Amount must be positive");
  }
  let usdc: bigint;
  let eth: bigint;
  try {
    [usdc, eth] = await Promise.all([
      fetchAramidBaseUsdcReserve(),
      fetchAramidBaseEthReserve(),
    ]);
  } catch {
    throw new Error(
      args.consumerCopy
        ? "Can't check if we can move USD right now. Try again in a moment."
        : "Could not read Aramid Base liquidity. Try again shortly."
    );
  }
  if (eth < MIN_BRIDGE_ETH_WEI || usdc < args.destinationAtomic) {
    throw new Error(
      args.consumerCopy
        ? "Can't move USD right now. Try again in a bit."
        : "Aramid Base liquidity is too low to complete this move. Try a smaller amount or retry later."
    );
  }
}
