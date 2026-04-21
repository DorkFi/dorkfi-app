import {
  MainnetPools,
  ONE_16_DP,
  retrievePoolInfo,
} from "@folks-finance/algorand-sdk";
import type { Algodv2 } from "algosdk";
import BigNumber from "bignumber.js";

/**
 * Folks mainnet ALGO lending pool deposit APY (fALGO supply yield), as percentage points for UI.
 * Uses on-chain `depositInterestYield` (16dp fixed-point) from {@link retrievePoolInfo}.
 */
export async function fetchFolksMainnetAlgoPoolDepositApyPercentPoints(
  algod: Algodv2
): Promise<number | null> {
  const pool = MainnetPools.ALGO;
  const info = await retrievePoolInfo(algod, pool);
  const y = info.interest.depositInterestYield;
  if (typeof y !== "bigint" || y <= BigInt(0)) {
    return null;
  }
  const pct = new BigNumber(y.toString())
    .div(new BigNumber(ONE_16_DP.toString()))
    .times(100)
    .decimalPlaces(4, BigNumber.ROUND_HALF_UP)
    .toNumber();
  return Number.isFinite(pct) && pct > 0 ? pct : null;
}
