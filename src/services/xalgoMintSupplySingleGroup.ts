import BigNumber from "bignumber.js";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
  type TokenStandard,
} from "@/config";
import algorandService, { type AlgorandNetwork } from "@/services/algorandService";
import { deposit } from "@/services/lendingService";
import {
  fetchXalgoMainnetConsensusState,
  minXalgoOutImmediateMintFloor,
} from "@/services/xalgoConsensusAdapter";

const MAX_ATOMIC_GROUP_TXNS = 16;

/**
 * One atomic group: governance xALGO `immediate_mint` (prepended inside `deposit()` `buildN`, same as
 * Folks f-asset mint for simulation), then nt200 + pool deposit for the minted xALGO minimum.
 */
export async function buildXalgoConsensusMintAndDepositSingleGroup(input: {
  userAddress: string;
  networkId: NetworkId;
  /** MicroAlgos locked in consensus mint. */
  algoMicroAlgos: bigint;
  poolId: string;
  marketId: string;
  tokenStandard: TokenStandard;
  /** Optional Folks deposit adapter id when the market uses a Folks preamble; omit for direct xALGO nt200. */
  depositAdapterId?: string;
}): Promise<{
  txnsB64: string[];
  minXalgoAtomic: string;
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
  const consensusState = await fetchXalgoMainnetConsensusState(algod);
  const minXalgoAtomic = minXalgoOutImmediateMintFloor(
    consensusState,
    input.algoMicroAlgos,
    150n
  );
  if (minXalgoAtomic <= 0n) {
    throw new Error("Amount is too small to mint a positive xALGO amount at current rates.");
  }

  const depositOpts: {
    depositAdapterId?: string;
    xalgoConsensusMintAlgoMicros: bigint;
  } = {
    xalgoConsensusMintAlgoMicros: input.algoMicroAlgos,
  };
  if (
    input.depositAdapterId != null &&
    String(input.depositAdapterId).trim() !== ""
  ) {
    depositOpts.depositAdapterId = String(input.depositAdapterId).trim();
  }

  const depositResult = await deposit(
    input.poolId,
    input.marketId,
    input.tokenStandard,
    minXalgoAtomic.toString(),
    input.userAddress,
    input.networkId,
    depositOpts
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
    minXalgoAtomic: minXalgoAtomic.toString(),
  };
}

export function formatXalgoAtomicAsHuman(
  atomic: string,
  decimals: number
): string {
  if (!/^\d+$/.test(atomic)) return atomic;
  let s = new BigNumber(atomic).dividedBy(10 ** decimals).toFixed(decimals);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  return s || "0";
}
