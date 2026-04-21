import BigNumber from "bignumber.js";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
  type TokenStandard,
} from "@/config";
import algorandService, { type AlgorandNetwork } from "@/services/algorandService";
import { deposit } from "@/services/lendingService";
import { fetchMinTalgoOutMintFloorFromChain } from "@/services/tinymanTalgoAdapter";

const MAX_ATOMIC_GROUP_TXNS = 16;

/**
 * One atomic group: Tinyman tALGO `mint` from ALGO (prepended inside `deposit()` `buildN`), then nt200 + pool deposit.
 */
export async function buildTalgoConsensusMintAndDepositSingleGroup(input: {
  userAddress: string;
  networkId: NetworkId;
  /** MicroAlgos sent to the Tinyman staking app for `mint`. */
  algoMicroAlgos: bigint;
  poolId: string;
  marketId: string;
  tokenStandard: TokenStandard;
}): Promise<{
  txnsB64: string[];
  minTalgoAtomic: string;
}> {
  if (input.networkId !== "algorand-mainnet") {
    throw new Error("Combined mint and supply is only available on Algorand mainnet.");
  }
  const aln = getAlgorandNetworkFromNetworkId(input.networkId);
  if (!aln) {
    throw new Error("Invalid Algorand network.");
  }

  const { algod } = await algorandService.initializeClientsForReads(
    aln as AlgorandNetwork
  );
  const minTalgoAtomic = await fetchMinTalgoOutMintFloorFromChain(
    algod,
    input.algoMicroAlgos,
    150n
  );
  if (minTalgoAtomic <= 0n) {
    throw new Error("Amount is too small to mint a positive tALGO amount at current rates.");
  }

  const depositResult = await deposit(
    input.poolId,
    input.marketId,
    input.tokenStandard,
    minTalgoAtomic.toString(),
    input.userAddress,
    input.networkId,
    { tinymanTalgoMintAlgoMicros: input.algoMicroAlgos }
  );
  if (!depositResult.success) {
    throw new Error(
      "error" in depositResult && depositResult.error
        ? depositResult.error
        : "Could not build lending deposit transactions."
    );
  }
  if (!("txns" in depositResult) || !depositResult.txns?.length) {
    throw new Error("Lending deposit returned no transactions.");
  }
  if (depositResult.txns.length > MAX_ATOMIC_GROUP_TXNS) {
    throw new Error(
      `This path needs ${depositResult.txns.length} transactions in one atomic group (Algorand max is ${MAX_ATOMIC_GROUP_TXNS}). Try a smaller amount or mint and supply in two steps.`
    );
  }

  return {
    txnsB64: depositResult.txns,
    minTalgoAtomic: minTalgoAtomic.toString(),
  };
}

export function formatTalgoAtomicAsHuman(
  atomic: string,
  decimals: number
): string {
  if (!/^\d+$/.test(atomic)) return atomic;
  let s = new BigNumber(atomic).dividedBy(10 ** decimals).toFixed(decimals);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  return s || "0";
}
