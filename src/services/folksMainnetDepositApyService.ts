import {
  MainnetPools,
  ONE_16_DP,
  retrievePoolInfo,
} from "@folks-finance/algorand-sdk";
import { FOLKS_FINANCE_ALGORAND_ECOSYSTEM_POOLS_BY_KEY } from "@/constants/folksFinance";
import type { Algodv2 } from "algosdk";
import BigNumber from "bignumber.js";

/** Folks “Algorand Ecosystem” USDC pool (fiUSDC); not in {@link MainnetPools}. */
const FIUSDC_ECOSYSTEM_FOLKS_POOL = (() => {
  const p = FOLKS_FINANCE_ALGORAND_ECOSYSTEM_POOLS_BY_KEY.USDC;
  return {
    appId: Number(p.appId),
    assetId: Number(p.assetId),
    fAssetId: Number(p.fAssetId),
    frAssetId: Number(p.frAssetId),
    assetDecimals: 6,
    poolManagerIndex: 0,
    loans: {},
  } as (typeof MainnetPools)["USDC"];
})();

function yieldFixed16ToApyPercentPoints(y: bigint): number | null {
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

/**
 * Folks mainnet ALGO lending pool deposit APY (fALGO supply yield), as percentage points for UI.
 * Uses on-chain `depositInterestYield` (16dp fixed-point) from {@link retrievePoolInfo}.
 */
export async function fetchFolksMainnetAlgoPoolDepositApyPercentPoints(
  algod: Algodv2
): Promise<number | null> {
  const info = await retrievePoolInfo(algod, MainnetPools.ALGO);
  return yieldFixed16ToApyPercentPoints(info.interest.depositInterestYield);
}

/** Live Folks mainnet USDC pool APY snapshot (% points) from {@link MainnetPools.USDC}. */
export type FolksMainnetUsdcPoolApySnapshot = {
  depositPercent: number | null;
  borrowPercent: number | null;
};

/**
 * Folks mainnet USDC lending pool deposit and variable borrow yields (16dp fixed-point),
 * as percentage points for UI — same source as fUSDC mint pool on Folks.
 */
export async function fetchFolksMainnetUsdcPoolApySnapshot(
  algod: Algodv2
): Promise<FolksMainnetUsdcPoolApySnapshot> {
  const pool = MainnetPools.USDC;
  const info = await retrievePoolInfo(algod, pool);
  return {
    depositPercent: yieldFixed16ToApyPercentPoints(
      info.interest.depositInterestYield
    ),
    borrowPercent: yieldFixed16ToApyPercentPoints(
      info.variableBorrow.variableBorrowInterestYield
    ),
  };
}

/**
 * Folks Algorand Ecosystem USDC pool (fiUSDC) deposit + variable borrow yields — same
 * `retrievePoolInfo` shape as mainnet USDC, different pool app id from docs.
 */
export async function fetchFolksMainnetFiUsdcEcosystemPoolApySnapshot(
  algod: Algodv2
): Promise<FolksMainnetUsdcPoolApySnapshot> {
  const info = await retrievePoolInfo(algod, FIUSDC_ECOSYSTEM_FOLKS_POOL);
  return {
    depositPercent: yieldFixed16ToApyPercentPoints(
      info.interest.depositInterestYield
    ),
    borrowPercent: yieldFixed16ToApyPercentPoints(
      info.variableBorrow.variableBorrowInterestYield
    ),
  };
}

/**
 * Folks Algorand Ecosystem TINY pool (fiTINY) deposit + variable borrow yields — same
 * `retrievePoolInfo` shape as {@link fetchFolksMainnetFiUsdcEcosystemPoolApySnapshot}, using
 * {@link MainnetPools.ISOLATED_TINY}.
 */
export async function fetchFolksMainnetFiTinyEcosystemPoolApySnapshot(
  algod: Algodv2
): Promise<FolksMainnetUsdcPoolApySnapshot> {
  const info = await retrievePoolInfo(algod, MainnetPools.ISOLATED_TINY);
  return {
    depositPercent: yieldFixed16ToApyPercentPoints(
      info.interest.depositInterestYield
    ),
    borrowPercent: yieldFixed16ToApyPercentPoints(
      info.variableBorrow.variableBorrowInterestYield
    ),
  };
}

/**
 * Folks V2 WBTC (NTT) lending pool deposit and variable borrow yields — {@link MainnetPools.WBTC_NTT}.
 */
export async function fetchFolksMainnetWbtcNttPoolApySnapshot(
  algod: Algodv2
): Promise<FolksMainnetUsdcPoolApySnapshot> {
  const info = await retrievePoolInfo(algod, MainnetPools.WBTC_NTT);
  return {
    depositPercent: yieldFixed16ToApyPercentPoints(
      info.interest.depositInterestYield
    ),
    borrowPercent: yieldFixed16ToApyPercentPoints(
      info.variableBorrow.variableBorrowInterestYield
    ),
  };
}
