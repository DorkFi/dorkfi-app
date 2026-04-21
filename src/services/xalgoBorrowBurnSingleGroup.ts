import BigNumber from "bignumber.js";
import {
  getAlgorandNetworkFromNetworkId,
  type NetworkId,
  type TokenStandard,
} from "@/config";
import algorandService, { type AlgorandNetwork } from "@/services/algorandService";
import { borrow } from "@/services/lendingService";
import {
  ALGORAND_MAINNET_NODELY_ALGOD_URL,
  fetchXalgoMainnetConsensusState,
  minAlgoOutBurnFloor,
  xalgoAtomicNeededForMinAlgoOutFloor,
} from "@/services/xalgoConsensusAdapter";

const MAX_ATOMIC_GROUP_TXNS = 16;

/**
 * One atomic group: lending `borrow` + nt200 `withdraw` (xALGO), then governance `burn` → ALGO.
 */
export async function buildXalgoConsensusBorrowAndBurnSingleGroup(input: {
  userAddress: string;
  networkId: NetworkId;
  /** Minimum microAlgos the user must receive from the trailing consensus `burn`. */
  desiredMinAlgoMicros: bigint;
  poolId: string;
  marketId: string;
  tokenStandard: TokenStandard;
}): Promise<{
  txnsB64: string[];
  borrowedXalgoAtomic: string;
  minAlgoOutAtomic: string;
}> {
  if (input.networkId !== "algorand-mainnet") {
    throw new Error("Borrow and receive ALGO is only available on Algorand mainnet.");
  }
  const aln = getAlgorandNetworkFromNetworkId(input.networkId);
  if (!aln) {
    throw new Error("Invalid Algorand network.");
  }

  const { algod } = await algorandService.initializeClientsForReads(
    aln as AlgorandNetwork,
    { algodServer: ALGORAND_MAINNET_NODELY_ALGOD_URL }
  );
  const consensusState = await fetchXalgoMainnetConsensusState(algod);
  const borrowedXalgoAtomic = xalgoAtomicNeededForMinAlgoOutFloor(
    consensusState,
    input.desiredMinAlgoMicros,
    150n
  );
  if (borrowedXalgoAtomic <= 0n) {
    throw new Error("Amount is too small at current rates.");
  }
  const minAlgoOut = minAlgoOutBurnFloor(
    consensusState,
    borrowedXalgoAtomic,
    150n
  );

  const borrowResult = await borrow(
    input.poolId,
    input.marketId,
    input.tokenStandard,
    borrowedXalgoAtomic.toString(),
    input.userAddress,
    input.networkId,
    { xalgoConsensusBorrowAppendBurn: true }
  );
  if (!borrowResult.success) {
    throw new Error(
      "error" in borrowResult && borrowResult.error
        ? borrowResult.error
        : "Could not build lending borrow transactions."
    );
  }
  if (!("txns" in borrowResult) || !borrowResult.txns?.length) {
    throw new Error("Lending borrow returned no transactions.");
  }
  if (borrowResult.txns.length > MAX_ATOMIC_GROUP_TXNS) {
    throw new Error(
      `This path needs ${borrowResult.txns.length} transactions in one atomic group (Algorand max is ${MAX_ATOMIC_GROUP_TXNS}). Try a smaller amount.`
    );
  }

  return {
    txnsB64: borrowResult.txns,
    borrowedXalgoAtomic: borrowedXalgoAtomic.toString(),
    minAlgoOutAtomic: minAlgoOut.toString(),
  };
}
