import {
  AddLiquidity,
  RemoveLiquidity,
  combineAndRegroupSignerTxns,
  generateOptIntoAssetTxns,
  poolUtils,
  tinymanJSSDKConfig,
  type PoolReserves,
  type SignerTransaction,
  type SupportedNetwork,
  type V2PoolInfo,
} from "@tinymanorg/tinyman-js-sdk";
import algosdk from "algosdk";
import BigNumber from "bignumber.js";
import { abi, CONTRACT } from "ulujs";
import {
  getAlgorandNetworkFromNetworkId,
  getAllTokens,
  type NetworkId,
} from "@/config";
import algorandService from "@/services/algorandService";
import { folksMintTxnsToArccjsExtraTxns } from "@/services/folksDepositAdapter";
import { tinymanRateFractionToPercentPoints } from "@/services/tinymanLiquidStakingService";
import type { LiquidityPoolPairConfig } from "@/constants/liquidityPools";
import { getAccountAssetHoldingAmountAtomic } from "@/utils/algodAccountAssetAmount";
import { spendableAlgoMicroAlgosFromAccount } from "@/utils/algorandWalletBalance";

const DEFAULT_SLIPPAGE = 0.01;

const TINYMAN_POOL_ANALYTICS_BASE: Record<SupportedNetwork, string> = {
  mainnet: "https://mainnet.analytics.tinyman.org/api/v1/pools",
  testnet: "https://testnet.analytics.tinyman.org/api/v1/pools",
};

const TINYMAN_STAKING_ANALYTICS_BASE: Record<SupportedNetwork, string> = {
  mainnet: "https://mainnet.analytics.tinyman.org/api/v1/staking/pool-programs",
  testnet: "https://testnet.analytics.tinyman.org/api/v1/staking/pool-programs",
};

export interface LiquidityPoolAssetMeta {
  assetId: number;
  symbol: string;
  decimals: number;
  logoPath?: string;
}

export interface LiquidityPoolApr {
  /** Swap-fee APR from Tinyman analytics (percentage points). */
  feeAprPercent: number | null;
  feeApyPercent: number | null;
  /** Fees + active staking programs (percentage points). */
  totalAprPercent: number | null;
  totalApyPercent: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
}

export interface LiquidityPoolSnapshot {
  pair: LiquidityPoolPairConfig;
  pool: V2PoolInfo;
  reserves: PoolReserves;
  asset1: LiquidityPoolAssetMeta;
  asset2: LiquidityPoolAssetMeta;
  poolTokenId: number;
  totalLiquidity: bigint;
  asset1ReserveHuman: string;
  asset2ReserveHuman: string;
  apr: LiquidityPoolApr | null;
  poolAddress: string;
}

export interface LiquidityPoolUserPosition {
  /** Wallet-held LP token (ASA) balance. */
  poolTokenBalance: bigint;
  /** LP balance deposited in the nt200 market (`lpContractId`). */
  nt200LpBalance: bigint;
  /** LP committed to a Tinyman farm program (wallet-held, tracked by Tinyman). */
  farmLpBalance: bigint;
  poolSharePercent: number;
}

export function tinymanNetworkFromNetworkId(
  networkId: NetworkId
): SupportedNetwork | null {
  if (networkId === "algorand-mainnet") return "mainnet";
  if (networkId === "algorand-testnet") return "testnet";
  return null;
}

export function resolveLiquidityAssetMeta(
  networkId: NetworkId,
  assetId: number
): LiquidityPoolAssetMeta {
  if (assetId === 0) {
    return {
      assetId: 0,
      symbol: "ALGO",
      decimals: 6,
      logoPath: "/lovable-uploads/Algo.webp",
    };
  }
  const tokens = getAllTokens(networkId);
  for (const t of tokens) {
    if (t.isStoken) continue;
    const raw = t.assetId;
    if (!raw || !/^\d+$/.test(raw)) continue;
    if (Number(raw) === assetId) {
      return {
        assetId,
        symbol: t.marketOverride?.displaySymbol ?? t.symbol,
        decimals: t.decimals,
        logoPath: t.logoPath,
      };
    }
  }
  return {
    assetId,
    symbol: `ASA ${assetId}`,
    decimals: 6,
  };
}

function toAtomic(human: string, decimals: number): bigint {
  const trimmed = human.trim();
  if (!trimmed || trimmed === ".") return 0n;
  const atomic = new BigNumber(trimmed)
    .times(new BigNumber(10).pow(decimals))
    .integerValue(BigNumber.ROUND_FLOOR)
    .toFixed(0);
  return BigInt(atomic);
}

function applyPairAssetOverrides(
  pair: LiquidityPoolPairConfig,
  assetId: number,
  meta: LiquidityPoolAssetMeta
): LiquidityPoolAssetMeta {
  if (assetId !== pair.asset2Id) return meta;
  return {
    ...meta,
    ...(pair.asset2Symbol ? { symbol: pair.asset2Symbol } : {}),
    ...(pair.asset2Decimals != null ? { decimals: pair.asset2Decimals } : {}),
    ...(pair.asset2LogoPath ? { logoPath: pair.asset2LogoPath } : {}),
  };
}

function snapshotAssetsInPairOrder(
  pair: LiquidityPoolPairConfig,
  pool: V2PoolInfo,
  reserves: PoolReserves
) {
  const poolAsset1 = applyPairAssetOverrides(
    pair,
    pool.asset1ID,
    resolveLiquidityAssetMeta(pair.networkId, pool.asset1ID)
  );
  const poolAsset2 = applyPairAssetOverrides(
    pair,
    pool.asset2ID,
    resolveLiquidityAssetMeta(pair.networkId, pool.asset2ID)
  );

  if (pair.asset1Id === pool.asset1ID) {
    return {
      asset1: poolAsset1,
      asset2: poolAsset2,
      asset1Reserve: reserves.asset1,
      asset2Reserve: reserves.asset2,
    };
  }

  return {
    asset1: poolAsset2,
    asset2: poolAsset1,
    asset1Reserve: reserves.asset2,
    asset2Reserve: reserves.asset1,
  };
}

async function fetchPoolApr(
  network: SupportedNetwork,
  poolAddress: string
): Promise<LiquidityPoolApr | null> {
  try {
    const res = await fetch(
      `${TINYMAN_POOL_ANALYTICS_BASE[network]}/${encodeURIComponent(poolAddress)}/`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      annual_percentage_rate?: string;
      annual_percentage_yield?: string;
      total_annual_percentage_rate?: string;
      total_annual_percentage_yield?: string;
      liquidity_in_usd?: string;
      last_day_volume_in_usd?: string;
    };
    const liquidityUsd = Number.parseFloat(data.liquidity_in_usd ?? "");
    const volume24hUsd = Number.parseFloat(data.last_day_volume_in_usd ?? "");
    return {
      feeAprPercent: tinymanRateFractionToPercentPoints(
        data.annual_percentage_rate
      ),
      feeApyPercent: tinymanRateFractionToPercentPoints(
        data.annual_percentage_yield
      ),
      totalAprPercent: tinymanRateFractionToPercentPoints(
        data.total_annual_percentage_rate
      ),
      totalApyPercent: tinymanRateFractionToPercentPoints(
        data.total_annual_percentage_yield
      ),
      liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : null,
      volume24hUsd: Number.isFinite(volume24hUsd) ? volume24hUsd : null,
    };
  } catch {
    return null;
  }
}

function fromAtomic(amount: bigint, decimals: number): string {
  return new BigNumber(amount.toString())
    .shiftedBy(-decimals)
    .decimalPlaces(Math.min(decimals, 6), BigNumber.ROUND_DOWN)
    .toFixed();
}

export async function fetchLiquidityPoolSnapshot(
  pair: LiquidityPoolPairConfig
): Promise<LiquidityPoolSnapshot | null> {
  if (pair.platform !== "tinyman") return null;

  const tinymanNet = tinymanNetworkFromNetworkId(pair.networkId);
  const algodNetwork = getAlgorandNetworkFromNetworkId(pair.networkId);
  if (!tinymanNet || !algodNetwork) return null;

  const { algod } = await algorandService.initializeClientsForReads(algodNetwork);
  const pool = await poolUtils.v2.getPoolInfo({
    client: algod,
    network: tinymanNet,
    asset1ID: pair.asset1Id,
    asset2ID: pair.asset2Id,
  });

  if (poolUtils.v2.isPoolNotCreated(pool)) {
    return null;
  }

  if (!poolUtils.v2.isPoolReady(pool) || !pool.poolTokenID) {
    return null;
  }

  const reserves = await poolUtils.v2.getPoolReserves(algod, pool);
  const ordered = snapshotAssetsInPairOrder(pair, pool, reserves);
  const poolAddress = pool.account.address().toString();
  const apr = await fetchPoolApr(tinymanNet, poolAddress);

  return {
    pair,
    pool,
    reserves,
    asset1: ordered.asset1,
    asset2: ordered.asset2,
    poolTokenId: pool.poolTokenID ?? pair.lpTokenId,
    totalLiquidity: reserves.issuedLiquidity,
    asset1ReserveHuman: fromAtomic(ordered.asset1Reserve, ordered.asset1.decimals),
    asset2ReserveHuman: fromAtomic(ordered.asset2Reserve, ordered.asset2.decimals),
    apr,
    poolAddress,
  };
}

export async function fetchAlgorandAssetBalance(
  networkId: NetworkId,
  userAddress: string,
  assetId: number
): Promise<bigint> {
  const algodNetwork = getAlgorandNetworkFromNetworkId(networkId);
  if (!algodNetwork) return 0n;

  const { algod } = await algorandService.initializeClientsForReads(algodNetwork);

  if (assetId === 0) {
    const account = await algod.accountInformation(userAddress).do();
    return spendableAlgoMicroAlgosFromAccount(account);
  }

  try {
    const holding = await algod.accountAssetInformation(userAddress, assetId).do();
    return getAccountAssetHoldingAmountAtomic(holding) ?? 0n;
  } catch {
    return 0n;
  }
}

async function fetchTinymanFarmLpCommitment(
  pair: LiquidityPoolPairConfig,
  userAddress: string,
  poolAddress: string,
  farmProgramId: number
): Promise<bigint> {
  const tinymanNet = tinymanNetworkFromNetworkId(pair.networkId);
  if (!tinymanNet) return 0n;

  try {
    const url = new URL(
      `${TINYMAN_STAKING_ANALYTICS_BASE[tinymanNet]}/${encodeURIComponent(poolAddress)}/${farmProgramId}/`
    );
    url.searchParams.set("pooler_address", userAddress);
    const res = await fetch(url.toString());
    if (!res.ok) return 0n;

    const data = (await res.json()) as {
      pooler?: {
        current_cycle_commitment?: { amount?: string } | null;
        next_cycle_commitment?: { amount?: string } | null;
      } | null;
    };

    const amountStr =
      data.pooler?.next_cycle_commitment?.amount ??
      data.pooler?.current_cycle_commitment?.amount;
    if (!amountStr || !/^\d+$/.test(amountStr)) return 0n;
    return BigInt(amountStr);
  } catch {
    return 0n;
  }
}

export async function fetchNt200Arc200Balance(
  networkId: NetworkId,
  contractId: number,
  userAddress: string
): Promise<bigint> {
  const algodNetwork = getAlgorandNetworkFromNetworkId(networkId);
  if (!algodNetwork) return 0n;

  try {
    const { algod } = await algorandService.initializeClientsForReads(algodNetwork);
    const ci = new CONTRACT(
      contractId,
      algod,
      undefined,
      abi.nt200,
      { addr: userAddress, sk: new Uint8Array() }
    );
    const result = await ci.arc200_balanceOf(userAddress);
    if (!result.success) return 0n;
    return BigInt(result.returnValue ?? 0);
  } catch {
    return 0n;
  }
}

export async function fetchLiquidityPoolUserPosition(
  pair: LiquidityPoolPairConfig,
  userAddress: string
): Promise<LiquidityPoolUserPosition | null> {
  const snapshot = await fetchLiquidityPoolSnapshot(pair);
  if (!snapshot) return null;

  const farmProgramId = pair.farms?.[0];
  const poolAddress = pair.poolAddr ?? snapshot.poolAddress;

  const [poolTokenBalance, nt200LpBalance, farmLpBalance] = await Promise.all([
    fetchAlgorandAssetBalance(pair.networkId, userAddress, snapshot.poolTokenId),
    fetchNt200Arc200Balance(pair.networkId, pair.lpContractId, userAddress),
    farmProgramId != null && poolAddress
      ? fetchTinymanFarmLpCommitment(
          pair,
          userAddress,
          poolAddress,
          farmProgramId
        )
      : Promise.resolve(0n),
  ]);
  const poolSharePercent = poolUtils.v2.getPoolShare(
    snapshot.totalLiquidity,
    poolTokenBalance
  );

  return { poolTokenBalance, nt200LpBalance, farmLpBalance, poolSharePercent };
}

async function isAccountOptedIntoAsset(
  algod: algosdk.Algodv2,
  address: string,
  assetId: number
): Promise<boolean> {
  if (assetId === 0) return true;
  try {
    await algod.accountAssetInformation(address, assetId).do();
    return true;
  } catch {
    return false;
  }
}

function encodeSignerTxnsForWallet(txGroup: SignerTransaction[]): Uint8Array[] {
  return txGroup.map(({ txn }) =>
    Uint8Array.from(algosdk.encodeUnsignedTransaction(txn))
  );
}

export async function buildAddLiquidityTransactions(params: {
  pair: LiquidityPoolPairConfig;
  userAddress: string;
  assetInId: number;
  amountHuman: string;
  slippage?: number;
}): Promise<SignerTransaction[]> {
  const { pair, userAddress, assetInId, amountHuman } = params;
  const slippage = params.slippage ?? DEFAULT_SLIPPAGE;
  const tinymanNet = tinymanNetworkFromNetworkId(pair.networkId);
  const algodNetwork = getAlgorandNetworkFromNetworkId(pair.networkId);
  if (!tinymanNet || !algodNetwork) {
    throw new Error("Liquidity pools are only available on Algorand networks.");
  }

  tinymanJSSDKConfig.setClientName("DorkFi-PreFi");
  const snapshot = await fetchLiquidityPoolSnapshot(pair);
  if (!snapshot) throw new Error("Pool is not ready for deposits.");

  const assetIn =
    assetInId === snapshot.asset1.assetId ? snapshot.asset1 : snapshot.asset2;
  const atomic = toAtomic(amountHuman, assetIn.decimals);
  if (atomic <= 0n) throw new Error("Enter an amount greater than zero.");

  const { algod } = await algorandService.initializeClientsForTransactions(
    algodNetwork
  );

  const quote = AddLiquidity.v2.withSingleAsset.getQuote({
    pool: snapshot.pool,
    assetIn: { id: assetIn.assetId, amount: atomic },
    decimals: {
      asset1: snapshot.asset1.decimals,
      asset2: snapshot.asset2.decimals,
    },
    slippage,
  });

  let txGroup = await AddLiquidity.v2.withSingleAsset.generateTxns({
    network: tinymanNet,
    client: algod,
    initiatorAddr: userAddress,
    poolAddress: snapshot.pool.account.address().toString(),
    assetIn: quote.assetIn,
    poolTokenId: snapshot.poolTokenId,
    minPoolTokenAssetAmount: quote.minPoolTokenAssetAmountWithSlippage,
  });

  const optedIn = await isAccountOptedIntoAsset(
    algod,
    userAddress,
    snapshot.poolTokenId
  );
  if (!optedIn) {
    txGroup = combineAndRegroupSignerTxns(
      await generateOptIntoAssetTxns({
        client: algod,
        assetID: snapshot.poolTokenId,
        initiatorAddr: userAddress,
      }),
      txGroup
    );
  }

  return txGroup;
}

const MAINNET_CUSTOM_BEACON_ID = 3209233839;

/** nt200 ASA deposit of LP tokens into the pool's nt200 market (`lpContractId`). */
export async function buildNt200LpDepositTransactions(params: {
  pair: LiquidityPoolPairConfig;
  userAddress: string;
  poolTokenAmountHuman: string;
}): Promise<string[]> {
  const { pair, userAddress, poolTokenAmountHuman } = params;
  const algodNetwork = getAlgorandNetworkFromNetworkId(pair.networkId);
  if (!algodNetwork) {
    throw new Error("Liquidity pools are only available on Algorand networks.");
  }

  const depositAmount = toAtomic(poolTokenAmountHuman, 6);
  if (depositAmount <= 0n) {
    throw new Error("Enter an LP amount greater than zero.");
  }

  const { algod } = await algorandService.initializeClientsForTransactions(
    algodNetwork
  );

  const preamble: Record<string, unknown>[] = [];
  const optedIn = await isAccountOptedIntoAsset(
    algod,
    userAddress,
    pair.lpTokenId
  );
  if (!optedIn) {
    const suggestedParams = await algod.getTransactionParams().do();
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: userAddress,
      receiver: userAddress,
      amount: 0,
      assetIndex: pair.lpTokenId,
      suggestedParams: {
        ...suggestedParams,
        flatFee: true,
        fee: 1000n,
      },
      note: new TextEncoder().encode("dorkfi: LP token opt-in"),
    });
    preamble.push(...folksMintTxnsToArccjsExtraTxns([optInTxn]));
  }

  const tokenContract = new CONTRACT(
    pair.lpContractId,
    algod,
    undefined,
    abi.nt200,
    {
      addr: userAddress,
      sk: new Uint8Array(),
    },
    true,
    false,
    true
  );

  const ci = new CONTRACT(
    pair.lpContractId,
    algod,
    undefined,
    abi.custom,
    {
      addr: userAddress,
      sk: new Uint8Array(),
    }
  );

  let lastError = "nt200 LP deposit failed";
  for (const needsBalanceBox of [false, true]) {
    const buildN: Record<string, unknown>[] = [...preamble];
    if (needsBalanceBox) {
      const txnO = (await tokenContract.createBalanceBox(userAddress)).obj as Record<
        string,
        unknown
      >;
      buildN.push({
        ...txnO,
        payment: 28501,
        note: new TextEncoder().encode("nt200 createBalanceBox"),
      });
    }

    const depositTxnO = (await tokenContract.deposit(depositAmount)).obj as Record<
      string,
      unknown
    >;
    buildN.push({
      ...depositTxnO,
      aamt: depositAmount,
      xaid: pair.lpTokenId,
      payment: 0,
      note: new TextEncoder().encode(
        `nt200 deposit ${poolTokenAmountHuman} LP`
      ),
    });

    ci.setFee(20000);
    ci.setEnableGroupResourceSharing(true);
    ci.setExtraTxns(buildN);
    if (pair.networkId === "algorand-mainnet") {
      ci.setBeaconId(MAINNET_CUSTOM_BEACON_ID);
    }

    const result = await ci.custom();
    if (result.success && result.txns) {
      return result.txns as string[];
    }
    lastError = String((result as { error?: string }).error ?? lastError);
  }

  throw new Error(lastError);
}

/** nt200 ASA withdraw of LP tokens back to the wallet from `lpContractId`. */
export async function buildNt200LpWithdrawTransactions(params: {
  pair: LiquidityPoolPairConfig;
  userAddress: string;
  poolTokenAmountHuman: string;
}): Promise<string[]> {
  const { pair, userAddress, poolTokenAmountHuman } = params;
  const algodNetwork = getAlgorandNetworkFromNetworkId(pair.networkId);
  if (!algodNetwork) {
    throw new Error("Liquidity pools are only available on Algorand networks.");
  }

  const withdrawAmount = toAtomic(poolTokenAmountHuman, 6);
  if (withdrawAmount <= 0n) {
    throw new Error("Enter an LP amount greater than zero.");
  }

  const { algod } = await algorandService.initializeClientsForTransactions(
    algodNetwork
  );

  let optInAxfer: Record<string, unknown> = {};
  const optedIn = await isAccountOptedIntoAsset(
    algod,
    userAddress,
    pair.lpTokenId
  );
  if (!optedIn) {
    optInAxfer = {
      xaid: pair.lpTokenId,
      snd: userAddress,
      arcv: userAddress,
    };
  }

  const tokenContract = new CONTRACT(
    pair.lpContractId,
    algod,
    undefined,
    abi.nt200,
    {
      addr: userAddress,
      sk: new Uint8Array(),
    },
    true,
    false,
    true
  );

  const ci = new CONTRACT(
    pair.lpContractId,
    algod,
    undefined,
    abi.custom,
    {
      addr: userAddress,
      sk: new Uint8Array(),
    }
  );

  const withdrawTxnO = (await tokenContract.withdraw(withdrawAmount)).obj as Record<
    string,
    unknown
  >;
  const buildN: Record<string, unknown>[] = [
    {
      ...withdrawTxnO,
      ...optInAxfer,
      note: new TextEncoder().encode(
        `nt200 withdraw ${poolTokenAmountHuman} LP`
      ),
    },
  ];

  ci.setFee(20000);
  ci.setEnableGroupResourceSharing(true);
  ci.setExtraTxns(buildN);
  if (pair.networkId === "algorand-mainnet") {
    ci.setBeaconId(MAINNET_CUSTOM_BEACON_ID);
  }

  const result = await ci.custom();
  if (result.success && result.txns) {
    return result.txns as string[];
  }

  throw new Error(
    String((result as { error?: string }).error ?? "nt200 LP withdraw failed")
  );
}

export async function buildRemoveLiquidityTransactions(params: {
  pair: LiquidityPoolPairConfig;
  userAddress: string;
  poolTokenAmountHuman: string;
  slippage?: number;
}): Promise<SignerTransaction[]> {
  const { pair, userAddress, poolTokenAmountHuman } = params;
  const slippage = params.slippage ?? DEFAULT_SLIPPAGE;
  const tinymanNet = tinymanNetworkFromNetworkId(pair.networkId);
  const algodNetwork = getAlgorandNetworkFromNetworkId(pair.networkId);
  if (!tinymanNet || !algodNetwork) {
    throw new Error("Liquidity pools are only available on Algorand networks.");
  }

  tinymanJSSDKConfig.setClientName("DorkFi-PreFi");
  const snapshot = await fetchLiquidityPoolSnapshot(pair);
  if (!snapshot) throw new Error("Pool is not ready for withdrawals.");

  const poolTokenDecimals = 6;
  const poolTokenIn = toAtomic(poolTokenAmountHuman, poolTokenDecimals);
  if (poolTokenIn <= 0n) throw new Error("Enter an LP amount greater than zero.");

  const { algod } = await algorandService.initializeClientsForTransactions(
    algodNetwork
  );

  const quote = RemoveLiquidity.v2.getQuote({
    pool: snapshot.pool,
    reserves: snapshot.reserves,
    poolTokenIn,
  });

  return RemoveLiquidity.v2.generateTxns({
    client: algod,
    pool: snapshot.pool,
    initiatorAddr: userAddress,
    poolTokenIn: quote.poolTokenIn.amount,
    minAsset1Amount: quote.asset1Out.amount,
    minAsset2Amount: quote.asset2Out.amount,
    slippage,
  });
}

export function quoteAddLiquidity(
  snapshot: LiquidityPoolSnapshot,
  assetInId: number,
  amountHuman: string,
  slippage = DEFAULT_SLIPPAGE
) {
  const assetIn =
    assetInId === snapshot.asset1.assetId ? snapshot.asset1 : snapshot.asset2;
  const atomic = toAtomic(amountHuman, assetIn.decimals);
  if (atomic <= 0n) return null;
  return AddLiquidity.v2.withSingleAsset.getQuote({
    pool: snapshot.pool,
    assetIn: { id: assetIn.assetId, amount: atomic },
    decimals: {
      asset1: snapshot.asset1.decimals,
      asset2: snapshot.asset2.decimals,
    },
    slippage,
  });
}

export function quoteRemoveLiquidity(
  snapshot: LiquidityPoolSnapshot,
  poolTokenAmountHuman: string
) {
  const poolTokenIn = toAtomic(poolTokenAmountHuman, 6);
  if (poolTokenIn <= 0n) return null;
  return RemoveLiquidity.v2.getQuote({
    pool: snapshot.pool,
    reserves: snapshot.reserves,
    poolTokenIn,
  });
}

export async function submitSignedLiquidityTransactions(
  networkId: NetworkId,
  signed: Uint8Array[]
): Promise<string> {
  const algodNetwork = getAlgorandNetworkFromNetworkId(networkId);
  if (!algodNetwork) throw new Error("Unsupported network.");
  const { algod } = await algorandService.initializeClientsForTransactions(
    algodNetwork
  );
  const res = await algod.sendRawTransaction(signed).do();
  return res.txid;
}

export { encodeSignerTxnsForWallet, fromAtomic as formatLiquidityAtomic };
