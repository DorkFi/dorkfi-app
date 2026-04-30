import algosdk from "algosdk";
import type { Algodv2 } from "algosdk";
import BigNumber from "bignumber.js";
import {
  MainnetOpUp,
  MainnetPoolManagerAppId,
  MainnetPools,
  calcDepositReturn,
  calcWithdrawReturn,
  prepareDepositIntoPool,
  prepareWithdrawFromPool,
  prefixWithOpUp,
  retrievePoolInfo,
} from "@folks-finance/algorand-sdk";
import {
  FOLKS_ALGORAND_ECOSYSTEM_USDC_SDK_POOL_NAME,
  FOLKS_FINANCE_ALGORAND_ECOSYSTEM_POOLS_BY_KEY,
} from "@/constants/folksFinance";

/** Ecosystem USDC pool shape for Folks SDK calls (not yet in {@link MainnetPools}). */
function folksSdkPoolUsdcAlgorandEcosystem(): (typeof MainnetPools)["USDC"] {
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
}

function resolveFolksMainnetPoolForSdk(
  poolName: string
): (typeof MainnetPools)[keyof typeof MainnetPools] | undefined {
  const fromSdk = MainnetPools[poolName as keyof typeof MainnetPools];
  if (fromSdk) return fromSdk;
  if (poolName === FOLKS_ALGORAND_ECOSYSTEM_USDC_SDK_POOL_NAME) {
    return folksSdkPoolUsdcAlgorandEcosystem();
  }
  return undefined;
}

/**
 * Human-readable f-asset amount → human-readable underlying equivalent,
 * given Folks mint output for 1.0 underlying in atomic units (same ratio as
 * {@link estimateFolksDepositMintedFAssetAmount} for `10^decimals` underlying).
 */
export function folksFAssetHumanToUnderlyingHuman(
  fAssetHuman: number,
  mintedFAssetForOneUnderlyingAtomic: bigint,
  decimals: number
): number {
  if (mintedFAssetForOneUnderlyingAtomic <= BigInt(0)) {
    return fAssetHuman;
  }
  const one = new BigNumber(10).pow(decimals);
  const m = new BigNumber(mintedFAssetForOneUnderlyingAtomic.toString());
  return new BigNumber(fAssetHuman).times(one).div(m).toNumber();
}

/**
 * Human-readable underlying amount → human-readable f-asset equivalent,
 * inverse of {@link folksFAssetHumanToUnderlyingHuman} for the same mint ratio.
 */
export function folksUnderlyingHumanToFAssetHuman(
  underlyingHuman: number,
  mintedFAssetForOneUnderlyingAtomic: bigint,
  decimals: number
): number {
  if (mintedFAssetForOneUnderlyingAtomic <= BigInt(0)) {
    return underlyingHuman;
  }
  const one = new BigNumber(10).pow(decimals);
  const m = new BigNumber(mintedFAssetForOneUnderlyingAtomic.toString());
  return new BigNumber(underlyingHuman).times(m).div(one).toNumber();
}

/**
 * Expected f-asset minted for a Folks pool deposit of `underlyingAmount` (smallest
 * underlying units), using live pool state. Same math as Folks SDK `calcDepositReturn`
 * (see `lend/formulae.js`: f-asset = underlying / depositInterestIndex at 14dp scale).
 * On-chain `deposit` return uint64 can differ by rounding; simulate the Folks group for exact.
 */
export async function estimateFolksDepositMintedFAssetAmount(input: {
  poolName: string;
  underlyingAmount: bigint;
  algod: Algodv2;
}): Promise<{ mintedFAsset: bigint; depositInterestIndex: bigint }> {
  if (input.underlyingAmount <= BigInt(0)) {
    return { mintedFAsset: BigInt(0), depositInterestIndex: BigInt(0) };
  }
  const pool = resolveFolksMainnetPoolForSdk(input.poolName);
  if (!pool) {
    throw new Error(
      `Unknown Folks mainnet pool "${input.poolName}" for mint estimate.`
    );
  }
  const poolInfo = await retrievePoolInfo(input.algod, pool);
  const depositInterestIndex = poolInfo.interest.depositInterestIndex;
  const mintedFAsset = calcDepositReturn(
    input.underlyingAmount,
    depositInterestIndex
  );
  return { mintedFAsset, depositInterestIndex };
}

function addrStr(
  a: { publicKey: Uint8Array } | Uint8Array | undefined
): string {
  if (!a) return "";
  const pk = "publicKey" in a ? (a as { publicKey: Uint8Array }).publicKey : a;
  return algosdk.encodeAddress(pk);
}

/**
 * Convert an unsigned `algosdk.Transaction` (application call) into an arccjs
 * `extraTxns` element (ulujs `builder.*.(...).obj` shape).
 */
export function unsignedAlgosdkTxnToArccjsExtraTxn(
  txn: algosdk.Transaction
): Record<string, unknown> {
  if (txn.type !== algosdk.TransactionType.appl || !txn.applicationCall) {
    throw new Error(
      `Folks mint preamble: expected application call transaction for arccjs extraTxns, got type="${String(txn.type)}"`
    );
  }
  const ac = txn.applicationCall;
  const row: Record<string, unknown> = {
    sender: algosdk.encodeAddress(txn.sender.publicKey),
    appIndex: Number(ac.appIndex),
    onComplete: ac.onComplete,
    appArgs: ac.appArgs,
    accounts: ac.accounts.map((a) =>
      algosdk.encodeAddress((a as { publicKey: Uint8Array }).publicKey)
    ),
    foreignApps: ac.foreignApps.map((n) => Number(n)),
    foreignAssets: ac.foreignAssets.map((n) => Number(n)),
    fee: Number(txn.fee),
  };
  const boxes = ac.boxes ?? [];
  if (boxes.length > 0) {
    row.boxes = boxes.map((b) => ({
      appIndex: Number(b.appIndex),
      name: b.name,
    }));
  }
  if (txn.note && txn.note.length > 0) {
    row.note = txn.note;
  }
  if (ac.approvalProgram.length > 0 || ac.clearProgram.length > 0) {
    row.approvalProgram = ac.approvalProgram;
    row.clearProgram = ac.clearProgram;
    row.numGlobalByteSlices = ac.numGlobalByteSlices;
    row.numGlobalInts = ac.numGlobalInts;
    row.numLocalByteSlices = ac.numLocalByteSlices;
    row.numLocalInts = ac.numLocalInts;
    row.extraPages = ac.extraPages;
  }
  if (ac.rejectVersion != null && Number(ac.rejectVersion) > 0) {
    row.rejectVersion = Number(ac.rejectVersion);
  }
  if (txn.rekeyTo) {
    row.reKeyTo = algosdk.encodeAddress(txn.rekeyTo.publicKey);
  }
  const access = ac.access ?? [];
  if (access.length > 0) {
    row.access = access;
  }
  return row;
}

/**
 * Folks `prepareDepositIntoPool` returns [algo/asset xfer → pool, pool `deposit` appl].
 * arccjs expects that xfer merged into the same `extraTxns` row as the following appl
 * (same pattern as nt200 `buildN.push({ ...txnO, payment / xaid+aamt })`).
 */
function mergePayWithFollowingAppl(
  pay: algosdk.Transaction,
  appl: algosdk.Transaction
): Record<string, unknown> {
  if (pay.type !== algosdk.TransactionType.pay || !pay.payment) {
    throw new Error("mergePayWithFollowingAppl: first txn is not pay");
  }
  if (appl.type !== algosdk.TransactionType.appl || !appl.applicationCall) {
    throw new Error("mergePayWithFollowingAppl: second txn is not appl");
  }
  const recv = addrStr(pay.payment.receiver);
  const poolApp = Number(appl.applicationCall.appIndex);
  const poolAddr = algosdk.getApplicationAddress(poolApp).toString();
  if (recv !== poolAddr) {
    throw new Error(
      `Folks mint: pay receiver ${recv} does not match following pool app ${poolApp} (${poolAddr})`
    );
  }
  return {
    ...unsignedAlgosdkTxnToArccjsExtraTxn(appl),
    payment: Number(pay.payment.amount),
  };
}

/**
 * True when `accountAssetInformation` failed because the account does not hold / is not opted into the ASA.
 * Different Algod / proxy responses use different status codes and message text ("asset missing", etc.).
 */
function looksLikeAccountMissingASA(error: unknown): boolean {
  const err = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
    cause?: { message?: string };
  };
  const status = err?.response?.status;
  if (status === 404 || status === 400) return true;
  const msg = `${err?.message ?? ""} ${err?.cause?.message ?? ""}`.toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("not opted") ||
    msg.includes("does not exist") ||
    msg.includes("asset missing") ||
    msg.includes("missing asset") ||
    msg.includes("asset not found") ||
    msg.includes("account does not hold") ||
    msg.includes("account does not have") ||
    msg.includes("must opt-in") ||
    msg.includes("must opt in") ||
    msg.includes("not opted in") ||
    msg.includes("no asset")
  );
}

/** Self axfer amount 0 = ASA opt-in (must not match {@link mergeAxferWithFollowingAppl}). */
function isStandaloneAsaOptInAxfer(t: algosdk.Transaction): boolean {
  if (t.type !== algosdk.TransactionType.axfer || !t.assetTransfer) {
    return false;
  }
  const at = t.assetTransfer;
  if (Number(at.assetIndex) <= 0) return false;
  if (BigInt(at.amount) !== BigInt(0)) return false;
  return addrStr(t.sender) === addrStr(at.receiver);
}

/**
 * arccjs `extraTxns` row: ASA opt-in (see arccjs `contract.js` — `snd===arcv`, `!xamt`) plus a dummy
 * app shape so `makeApplicationCallTxnFromObject` succeeds; `ignore: true` skips pushing the dummy appl.
 */
function fAssetOptInToArccjsExtraTxn(
  axfer: algosdk.Transaction,
  opup: { callerAppId: number; baseAppId: number }
): Record<string, unknown> {
  const at = axfer.assetTransfer!;
  const user = addrStr(axfer.sender);
  return {
    sender: user,
    appIndex: opup.callerAppId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [algosdk.encodeUint64(0)],
    accounts: [],
    foreignApps: [opup.baseAppId],
    foreignAssets: [],
    fee: 2000,
    xaid: Number(at.assetIndex),
    snd: user,
    arcv: addrStr(at.receiver),
    ignore: true,
  };
}

function mergeAxferWithFollowingAppl(
  axfer: algosdk.Transaction,
  appl: algosdk.Transaction
): Record<string, unknown> {
  if (axfer.type !== algosdk.TransactionType.axfer || !axfer.assetTransfer) {
    throw new Error("mergeAxferWithFollowingAppl: first txn is not axfer");
  }
  if (appl.type !== algosdk.TransactionType.appl || !appl.applicationCall) {
    throw new Error("mergeAxferWithFollowingAppl: second txn is not appl");
  }
  const at = axfer.assetTransfer;
  if (at.assetSender) {
    throw new Error(
      "Folks mint: axfer with assetSender (rekey/clawback) is not supported for arccjs extraTxns merge"
    );
  }
  const recv = addrStr(at.receiver);
  const poolApp = Number(appl.applicationCall.appIndex);
  const poolAddr = algosdk.getApplicationAddress(poolApp).toString();
  if (recv !== poolAddr) {
    throw new Error(
      `Folks mint: axfer receiver ${recv} does not match following pool app ${poolApp}`
    );
  }
  if (addrStr(axfer.sender) !== addrStr(appl.sender)) {
    throw new Error(
      "Folks mint: axfer sender must match following appl sender for arccjs merge"
    );
  }
  return {
    ...unsignedAlgosdkTxnToArccjsExtraTxn(appl),
    xaid: Number(at.assetIndex),
    aamt: Number(at.amount),
  };
}

export function folksMintTxnsToArccjsExtraTxns(
  txns: algosdk.Transaction[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i];
    const next = txns[i + 1];

    if (isStandaloneAsaOptInAxfer(t)) {
      out.push(fAssetOptInToArccjsExtraTxn(t, MainnetOpUp));
      continue;
    }

    if (
      t.type === algosdk.TransactionType.pay &&
      next &&
      next.type === algosdk.TransactionType.appl &&
      next.applicationCall
    ) {
      out.push(mergePayWithFollowingAppl(t, next));
      i += 1;
      continue;
    }

    if (
      t.type === algosdk.TransactionType.axfer &&
      next &&
      next.type === algosdk.TransactionType.appl &&
      next.applicationCall
    ) {
      out.push(mergeAxferWithFollowingAppl(t, next));
      i += 1;
      continue;
    }

    out.push(unsignedAlgosdkTxnToArccjsExtraTxn(t));
  }
  return out;
}

/**
 * Build unsigned Folks Finance “mint f-asset” transactions (pool deposit + OpUp),
 * matching {@link https://github.com/Folks-Finance/algorand-js-sdk/blob/main/src/lend/deposit.ts prepareDepositIntoPool}
 * and the FolksMCP-style flow (prepare + {@link prefixWithOpUp}).
 */
export async function buildFolksDepositMintTxns(input: {
  poolName: string;
  userAddress: string;
  amount: bigint;
  algod: Algodv2;
}): Promise<algosdk.Transaction[]> {
  const pool = resolveFolksMainnetPoolForSdk(input.poolName);
  if (!pool) {
    throw new Error(
      `Unknown Folks mainnet pool "${input.poolName}". Extend MainnetPools or adapter config.`
    );
  }
  if (input.amount <= BigInt(0)) {
    return [];
  }

  const sp = await input.algod.getTransactionParams().do();
  const suggestedParams: algosdk.SuggestedParams = {
    ...sp,
    flatFee: true,
    fee: 0n,
  };

  let txns = prepareDepositIntoPool(
    pool,
    MainnetPoolManagerAppId,
    input.userAddress,
    input.userAddress,
    input.amount,
    suggestedParams,
    new TextEncoder().encode("dorkfi: Folks mint (deposit preamble)")
  );

  const fAssetId = Number(pool.fAssetId);
  if (Number.isFinite(fAssetId) && fAssetId > 0) {
    try {
      await input.algod
        .accountAssetInformation(input.userAddress, fAssetId)
        .do();
    } catch (error: unknown) {
      if (looksLikeAccountMissingASA(error)) {
        const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: input.userAddress,
          receiver: input.userAddress,
          amount: 0,
          assetIndex: fAssetId,
          suggestedParams: {
            ...suggestedParams,
            flatFee: true,
            fee: 1000n,
          },
          note: new TextEncoder().encode("dorkfi: Folks f-asset opt-in (mint preamble)"),
        });
        txns = [optInTxn, ...txns];
      } else {
        throw error;
      }
    }
  }

  txns = prefixWithOpUp(
    MainnetOpUp,
    input.userAddress,
    txns,
    0,
    suggestedParams
  );
  return txns;
}

/**
 * Unsigned Folks “redeem f-asset → underlying” group (pool `withdraw` + OpUp),
 * for use after nt200 releases f-ASA to the user in the same atomic group.
 */
export async function buildFolksWithdrawFromPoolTxns(input: {
  poolName: string;
  userAddress: string;
  receiverAddress?: string;
  fAssetAmount: bigint;
  algod: Algodv2;
}): Promise<algosdk.Transaction[]> {
  const pool = resolveFolksMainnetPoolForSdk(input.poolName);
  if (!pool) {
    throw new Error(
      `Unknown Folks mainnet pool "${input.poolName}" for withdraw-from-pool.`
    );
  }
  if (input.fAssetAmount <= BigInt(0)) {
    return [];
  }

  const poolInfo = await retrievePoolInfo(input.algod, pool);
  const diit = poolInfo.interest.depositInterestIndex;
  const receivedAssetAmount =
    diit > BigInt(0)
      ? calcWithdrawReturn(input.fAssetAmount, diit)
      : BigInt(0);

  const sp = await input.algod.getTransactionParams().do();
  const suggestedParams: algosdk.SuggestedParams = {
    ...sp,
    flatFee: true,
    fee: 0n,
  };

  const recv = input.receiverAddress ?? input.userAddress;
  let txns = prepareWithdrawFromPool(
    pool,
    MainnetPoolManagerAppId,
    input.userAddress,
    recv,
    input.fAssetAmount,
    0, //receivedAssetAmount,
    suggestedParams
  );
  txns = prefixWithOpUp(
    MainnetOpUp,
    input.userAddress,
    txns,
    0,
    suggestedParams
  );
  return txns;
}

/** Prepend Folks txns to an unsigned base64 txn group and re-assign group id. */
export function prependUnsignedTxnsToGroup(
  prefix: algosdk.Transaction[],
  groupB64: string[]
): string[] {
  if (prefix.length === 0) return groupB64;
  const rest = groupB64.map((b64) =>
    algosdk.decodeUnsignedTransaction(Buffer.from(b64, "base64"))
  );
  const merged = [...prefix, ...rest];
  algosdk.assignGroupID(merged);
  return merged.map((t) =>
    Buffer.from(algosdk.encodeUnsignedTransaction(t)).toString("base64")
  );
}
