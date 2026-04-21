import algosdk from "algosdk";
import type { Algodv2, SuggestedParams, Transaction } from "algosdk";
import {
  MainnetConsensusConfig,
  getConsensusState,
  prepareImmediateStakeTransactions,
  prepareUnstakeTransactions,
} from "@folks-finance/algorand-sdk";
import type { ConsensusState } from "@folks-finance/algorand-sdk";

/**
 * Nodely Algod for xALGO consensus reads and mint simulation (public RPC).
 * @see https://mainnet-api.4160.nodely.dev
 */
export const ALGORAND_MAINNET_NODELY_ALGOD_URL =
  "https://mainnet-api.4160.nodely.dev";

/**
 * Stable id for the synthetic “deposit from ALGO” route (Governance xALGO `immediate_mint`, not Folks f-xALGO).
 */
export const XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID =
  "xalgo-mainnet-consensus-deposit-algo";

/**
 * Synthetic “borrow and receive ALGO” route: borrow xALGO from lending, then governance `burn`
 * in the same atomic group (not a Folks adapter id).
 */
export const XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID =
  "xalgo-mainnet-consensus-borrow-algo";

/**
 * Synthetic “withdraw and receive ALGO” route: nt200 releases xALGO, then governance `burn`
 * in the same atomic group (not a Folks adapter id).
 */
export const XALGO_CONSENSUS_WITHDRAW_ALGO_ROUTE_ID =
  "xalgo-mainnet-consensus-withdraw-algo";

/**
 * Synthetic “repay using ALGO” route: governance `immediate_mint` (ALGO → xALGO), then nt200 deposit + lending
 * repay in one atomic group (same pattern as consensus mint + deposit).
 */
export const XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID =
  "xalgo-mainnet-consensus-repay-algo";

/**
 * Folks **Governance xALGO** consensus app — ALGO ↔ xALGO (liquid staking ASA), not Folks **lending** f-xALGO.
 *
 * ABI methods (see Folks [`xalgo.json`](https://github.com/Folks-Finance/algorand-js-sdk/blob/main/src/xalgo/abi-contracts/xalgo.json)):
 * - **`immediate_mint`** — pay ALGO into the consensus app, receive xALGO at `receiverAddr`.
 * - **`burn`** — axfer xALGO into the app, receive ALGO at `receiverAddr`.
 *
 * The SDK maps these to {@link prepareImmediateStakeTransactions} and {@link prepareUnstakeTransactions}.
 * For xALGO → **f-xALGO** → DorkFi nt200, use {@link folksDepositAdapter} + Folks pool `xALGO` in config instead.
 */

export { MainnetConsensusConfig };

export async function fetchXalgoMainnetConsensusState(
  algod: Algodv2
): Promise<ConsensusState> {
  return getConsensusState(algod, MainnetConsensusConfig);
}

function accountInfoShowsAssetOptIn(
  account: {
    assets?: Array<{ assetId?: bigint | number; "asset-id"?: bigint | number }>;
  },
  assetIndex: number
): boolean {
  const rows = account.assets ?? [];
  return rows.some((row) => {
    const raw = row.assetId ?? row["asset-id"];
    if (raw == null) return false;
    const id = typeof raw === "bigint" ? Number(raw) : Number(raw);
    return id === assetIndex;
  });
}

async function accountOptedInToAsset(
  algod: Algodv2,
  address: string,
  assetIndex: number
): Promise<boolean> {
  try {
    const info = await algod.accountInformation(address).do();
    return accountInfoShowsAssetOptIn(info as any, assetIndex);
  } catch {
    return false;
  }
}

/**
 * Unsigned governance `immediate_mint` group plus optional xALGO ASA opt-in (same shape as
 * {@link buildXalgoImmediateMintTxns} for merging into lending `deposit` `buildN` via
 * {@link folksMintTxnsToArccjsExtraTxns}).
 */
export async function buildGovernanceXalgoMintUnsignedWithOptionalOptIn(input: {
  algod: Algodv2;
  senderAddr: string;
  receiverAddr: string;
  algoMicroAlgos: bigint;
  suggestedParams: SuggestedParams;
}): Promise<{ unsigned: Transaction[]; consensusState: ConsensusState }> {
  const { txns, consensusState } = await buildXalgoImmediateMintTxns({
    algod: input.algod,
    senderAddr: input.senderAddr,
    receiverAddr: input.receiverAddr,
    algoAmount: input.algoMicroAlgos,
    suggestedParams: input.suggestedParams,
    minXalgoSlippageBps: 150n,
  });
  const xAlgoAsa = MainnetConsensusConfig.xAlgoId;
  if (await accountOptedInToAsset(input.algod, input.senderAddr, xAlgoAsa)) {
    return { unsigned: [...txns], consensusState };
  }
  const optIn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: input.senderAddr,
    receiver: input.senderAddr,
    amount: 0,
    assetIndex: xAlgoAsa,
    suggestedParams: {
      ...input.suggestedParams,
      flatFee: true,
      fee: 1000n,
    },
  });
  return { unsigned: [optIn, ...txns], consensusState };
}

/**
 * Conservative `min_received` (xALGO smallest units) for `immediate_mint`, from live
 * `get_xalgo_rate`-style ratio (algo reserve vs xALGO supply) with slippage haircut.
 */
export function minXalgoOutImmediateMintFloor(
  consensusState: ConsensusState,
  algoMicroAlgos: bigint,
  slippageBps: bigint = 150n
): bigint {
  if (algoMicroAlgos <= 0n) return 0n;
  const algoBal = consensusState.algoBalance;
  const xCirc = consensusState.xAlgoCirculatingSupply;
  if (algoBal <= 0n || xCirc <= 0n) return 0n;
  const gross = (algoMicroAlgos * xCirc) / algoBal;
  const out = (gross * (10000n - slippageBps)) / 10000n;
  if (out > 0n) return out;
  return gross > 0n ? 1n : 0n;
}

/**
 * Minimum microAlgos to send to `immediate_mint` so {@link minXalgoOutImmediateMintFloor} is at least
 * `targetXalgoAtomic` (monotone in ALGO; binary search). Used for repay-in-ALGO max / repay-all sizing.
 */
export function algoMicroNeededForMinXalgoOutImmediateMintFloor(
  consensusState: ConsensusState,
  targetXalgoAtomic: bigint,
  slippageBps: bigint = 150n
): bigint {
  if (targetXalgoAtomic <= 0n) return 0n;
  let lo = 1n;
  let hi = targetXalgoAtomic * 2n;
  if (hi < 1_000_000n) hi = 1_000_000n;
  for (let i = 0; i < 80; i++) {
    const out = minXalgoOutImmediateMintFloor(consensusState, hi, slippageBps);
    if (out >= targetXalgoAtomic) break;
    hi *= 2n;
    if (hi > 1_000_000_000_000_000_000n) {
      throw new Error(
        "Could not bound ALGO amount for this xALGO repayment. Try a smaller debt or repay in xALGO."
      );
    }
  }
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const out = minXalgoOutImmediateMintFloor(consensusState, mid, slippageBps);
    if (out >= targetXalgoAtomic) hi = mid;
    else lo = mid + 1n;
  }
  return lo;
}

/**
 * Conservative `min_received` (microAlgos) for governance xALGO `burn` / unstake,
 * inverse of the pool ratio used for {@link minXalgoOutImmediateMintFloor}, with the same slippage haircut.
 */
export function minAlgoOutBurnFloor(
  consensusState: ConsensusState,
  xalgoAtomic: bigint,
  slippageBps: bigint = 150n
): bigint {
  if (xalgoAtomic <= 0n) return 0n;
  const algoBal = consensusState.algoBalance;
  const xCirc = consensusState.xAlgoCirculatingSupply;
  if (algoBal <= 0n || xCirc <= 0n) return 0n;
  const gross = (xalgoAtomic * algoBal) / xCirc;
  const out = (gross * (10000n - slippageBps)) / 10000n;
  if (out > 0n) return out;
  return gross > 0n ? 1n : 0n;
}

/**
 * Minimum xALGO (smallest units) to borrow then burn so {@link minAlgoOutBurnFloor} is at least
 * `targetAlgoMicro` (same slippage bps as the burn floor).
 */
export function xalgoAtomicNeededForMinAlgoOutFloor(
  consensusState: ConsensusState,
  targetAlgoMicro: bigint,
  slippageBps: bigint = 150n
): bigint {
  if (targetAlgoMicro <= 0n) return 0n;
  const algoBal = consensusState.algoBalance;
  const xCirc = consensusState.xAlgoCirculatingSupply;
  if (algoBal <= 0n || xCirc <= 0n) return 0n;
  const den = 10000n - slippageBps;
  const grossMin = (targetAlgoMicro * 10000n + den - 1n) / den;
  let xNeeded = (grossMin * xCirc + algoBal - 1n) / algoBal;
  for (let i = 0; i < 64; i++) {
    if (minAlgoOutBurnFloor(consensusState, xNeeded, slippageBps) >= targetAlgoMicro) {
      return xNeeded;
    }
    xNeeded += 1n;
  }
  throw new Error(
    "Could not derive xALGO borrow size for the requested ALGO amount. Try a slightly smaller amount."
  );
}

export async function buildXalgoImmediateMintTxns(input: {
  algod: Algodv2;
  senderAddr: string;
  receiverAddr: string;
  /** MicroAlgos sent to the consensus app (inner pay for `immediate_mint`). */
  algoAmount: number | bigint;
  /**
   * Minimum xALGO (smallest unit) the user must receive, else the group fails.
   * Omit to use {@link minXalgoOutImmediateMintFloor} after loading consensus state.
   */
  minXalgoReceived?: number | bigint;
  /** Used only when `minXalgoReceived` is omitted; default 150 (1.5%). */
  minXalgoSlippageBps?: bigint;
  suggestedParams: SuggestedParams;
  /** Optional; Folks docs: pass to be eligible for revenue share / attribution. */
  note?: Uint8Array;
}): Promise<{ txns: Transaction[]; consensusState: ConsensusState }> {
  const consensusState = await getConsensusState(input.algod, MainnetConsensusConfig);
  if (!consensusState.canImmediateStake) {
    throw new Error(
      "Immediate xALGO mint is not available on-chain right now. Try again later."
    );
  }
  const algoMicro =
    typeof input.algoAmount === "bigint"
      ? input.algoAmount
      : BigInt(Math.trunc(Number(input.algoAmount)));
  const minReceived =
    input.minXalgoReceived !== undefined && input.minXalgoReceived !== null
      ? typeof input.minXalgoReceived === "bigint"
        ? input.minXalgoReceived
        : BigInt(Math.trunc(Number(input.minXalgoReceived)))
      : minXalgoOutImmediateMintFloor(
          consensusState,
          algoMicro,
          input.minXalgoSlippageBps ?? 150n
        );
  const txns = prepareImmediateStakeTransactions(
    MainnetConsensusConfig,
    consensusState,
    input.senderAddr,
    input.receiverAddr,
    input.algoAmount,
    minReceived,
    input.suggestedParams,
    input.note
  );
  return { txns, consensusState };
}

export async function buildXalgoBurnTxns(input: {
  algod: Algodv2;
  senderAddr: string;
  /** Address that receives ALGO from the `burn` call. */
  receiverAddr: string;
  /** xALGO amount in smallest units (axfer into consensus app). */
  xalgoAmount: number | bigint;
  /** Minimum microAlgos the user must receive, else the group fails. */
  minAlgoReceived: number | bigint;
  suggestedParams: SuggestedParams;
  note?: Uint8Array;
}): Promise<{ txns: Transaction[]; consensusState: ConsensusState }> {
  const consensusState = await getConsensusState(input.algod, MainnetConsensusConfig);
  const txns = prepareUnstakeTransactions(
    MainnetConsensusConfig,
    consensusState,
    input.senderAddr,
    input.receiverAddr,
    input.xalgoAmount,
    input.minAlgoReceived,
    input.suggestedParams,
    input.note
  );
  return { txns, consensusState };
}
