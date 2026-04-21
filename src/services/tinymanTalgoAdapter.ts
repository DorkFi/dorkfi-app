import algosdk from "algosdk";
import type { Algodv2, SuggestedParams, Transaction } from "algosdk";

/** Tinyman liquid staking (tALGO) application on Algorand mainnet. @see https://docs.tinyman.org/liquid-staking/liquid-staking */
export const MAINNET_TALGO_LIQUID_STAKING_APP_ID = 2537013674;

/** tALGO ASA id (matches lending config `tokens.tALGO.assetId`). */
export const MAINNET_TALGO_ASA_ID = 2537013734;

/**
 * Synthetic “deposit from ALGO” route (Tinyman `mint` + lending supply), not a Folks adapter id.
 * @see https://github.com/tinymanorg/tinyman-consensus-staking
 */
export const TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID =
  "talgo-mainnet-tinyman-deposit-algo";

type TealValueLike = {
  type?: number;
  uint?: number | bigint | string;
  bytes?: string | Uint8Array;
};

type GlobalStateEntry = {
  key: string | Uint8Array;
  value: TealValueLike;
};

/** Algod REST uses `global-state`; algosdk `getApplicationByID().do()` uses `globalState`. */
function readApplicationGlobalState(
  appResponse: unknown
): GlobalStateEntry[] | null {
  const params = (appResponse as { params?: Record<string, unknown> })?.params;
  if (!params) return null;
  const gs =
    (params.globalState as unknown) ?? params["global-state"];
  return Array.isArray(gs) ? (gs as GlobalStateEntry[]) : null;
}

function decodeGlobalStateKey(key: string | Uint8Array): string {
  if (key instanceof Uint8Array) {
    return Buffer.from(key).toString("utf8");
  }
  try {
    return Buffer.from(key, "base64").toString("utf8");
  } catch {
    return key;
  }
}

function addressFromGlobalValue(v: TealValueLike | undefined): string | null {
  if (!v?.bytes) return null;
  const b = v.bytes;
  let raw: Buffer;
  if (typeof b === "string") {
    if (String(b).trim() === "") return null;
    raw = Buffer.from(b, "base64");
  } else {
    raw = Buffer.from(b);
  }
  if (raw.length !== 32) return null;
  return algosdk.encodeAddress(new Uint8Array(raw));
}

function uintFromGlobalValue(v: TealValueLike | undefined): bigint | null {
  if (v == null || v.uint == null) return null;
  const n = BigInt(v.uint as bigint | number | string);
  return n > 0n ? n : null;
}

export type TalgoMainnetAppBinding = {
  appId: number;
  talgoAssetId: number;
  nodeAccounts: [string, string, string, string];
  /** On-chain total minted tALGO (app global `minted_talgo`) — use with {@link minTalgoOutMintFloorFromOnChainPool}. */
  mintedTalgo: bigint;
  /** On-chain ALGO in the staking pool (app global `algo_balance`). */
  algoBalance: bigint;
};

/**
 * Conservative tALGO floor for a `mint` payment of `algoMicroAlgos`, using the same ratio the
 * contract tracks: `minted_talgo / algo_balance` (not Tinyman analytics `total_staked_talgo_amount`,
 * which can diverge ~2× from `minted_talgo` on mainnet).
 */
export function minTalgoOutMintFloorFromOnChainPool(input: {
  algoMicroAlgos: bigint;
  mintedTalgo: bigint;
  algoBalance: bigint;
  slippageBps?: bigint;
}): bigint {
  const bps = input.slippageBps ?? 150n;
  if (input.algoMicroAlgos <= 0n) return 0n;
  if (input.mintedTalgo <= 0n || input.algoBalance <= 0n) return 0n;
  const gross =
    (input.algoMicroAlgos * input.mintedTalgo) / input.algoBalance;
  const out = (gross * (10000n - bps)) / 10000n;
  return out > 0n ? out : 0n;
}

export async function fetchMinTalgoOutMintFloorFromChain(
  algod: Algodv2,
  algoMicroAlgos: bigint,
  slippageBps: bigint = 150n
): Promise<bigint> {
  const b = await fetchTalgoMainnetAppBinding(algod);
  return minTalgoOutMintFloorFromOnChainPool({
    algoMicroAlgos,
    mintedTalgo: b.mintedTalgo,
    algoBalance: b.algoBalance,
    slippageBps,
  });
}

export async function fetchTalgoMainnetAppBinding(algod: Algodv2): Promise<TalgoMainnetAppBinding> {
  const res = await algod.getApplicationByID(MAINNET_TALGO_LIQUID_STAKING_APP_ID).do();
  const gs = readApplicationGlobalState(res);
  if (!gs) {
    throw new Error(
      "Tinyman tALGO app: missing global state (could not read params.globalState)."
    );
  }
  const byKey = new Map<string, TealValueLike>();
  for (const row of gs) {
    byKey.set(decodeGlobalStateKey(row.key), row.value);
  }
  const a1 = addressFromGlobalValue(byKey.get("account_1"));
  const a2 = addressFromGlobalValue(byKey.get("account_2"));
  const a3 = addressFromGlobalValue(byKey.get("account_3"));
  const a4 = addressFromGlobalValue(byKey.get("account_4"));
  const talgoU = uintFromGlobalValue(byKey.get("talgo_asset_id"));
  const mintedTalgo = uintFromGlobalValue(byKey.get("minted_talgo"));
  const algoBalance = uintFromGlobalValue(byKey.get("algo_balance"));
  if (!a1 || !a2 || !a3 || !a4 || talgoU == null) {
    throw new Error(
      "Tinyman tALGO app: incomplete globals (account_1..4 / talgo_asset_id)."
    );
  }
  if (mintedTalgo == null || algoBalance == null) {
    throw new Error(
      "Tinyman tALGO app: missing minted_talgo or algo_balance (cannot size mint + deposit)."
    );
  }
  const talgoAssetId = Number(talgoU);
  if (!Number.isFinite(talgoAssetId) || talgoAssetId <= 0) {
    throw new Error("Tinyman tALGO app: invalid talgo_asset_id.");
  }
  return {
    appId: MAINNET_TALGO_LIQUID_STAKING_APP_ID,
    talgoAssetId,
    nodeAccounts: [a1, a2, a3, a4],
    mintedTalgo,
    algoBalance,
  };
}

async function accountOptedInToAsset(
  algod: Algodv2,
  address: string,
  assetIndex: number
): Promise<boolean> {
  try {
    await algod.accountAssetInformation(address, assetIndex).do();
    return true;
  } catch {
    return false;
  }
}

/**
 * Unsigned Tinyman `mint` group (optional tALGO opt-in, pay microAlgos to app, `mint` appl),
 * same shape as governance xALGO mint for merging via {@link folksMintTxnsToArccjsExtraTxns}.
 */
export async function buildTalgoMintUnsignedWithOptionalOptIn(input: {
  algod: Algodv2;
  senderAddr: string;
  algoMicroAlgos: bigint;
  suggestedParams: SuggestedParams;
}): Promise<{ unsigned: Transaction[] }> {
  if (input.algoMicroAlgos <= 0n) {
    throw new Error("ALGO amount must be positive.");
  }
  const binding = await fetchTalgoMainnetAppBinding(input.algod);
  if (binding.talgoAssetId !== MAINNET_TALGO_ASA_ID) {
    throw new Error(
      `Unexpected Tinyman talgo_asset_id ${binding.talgoAssetId} (expected ${MAINNET_TALGO_ASA_ID}).`
    );
  }
  const appAddr = algosdk.getApplicationAddress(binding.appId);
  const out: Transaction[] = [];

  if (
    !(await accountOptedInToAsset(
      input.algod,
      input.senderAddr,
      binding.talgoAssetId
    ))
  ) {
    out.push(
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: input.senderAddr,
        receiver: input.senderAddr,
        amount: 0,
        assetIndex: binding.talgoAssetId,
        suggestedParams: {
          ...input.suggestedParams,
          flatFee: true,
          fee: 1000n,
        },
      })
    );
  }

  const pay = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: input.senderAddr,
    receiver: appAddr,
    amount: input.algoMicroAlgos,
    suggestedParams: {
      ...input.suggestedParams,
      flatFee: true,
      fee: 0n,
    },
  });

  const enc = new TextEncoder();
  const mintAmt =
    input.algoMicroAlgos > BigInt(Number.MAX_SAFE_INTEGER)
      ? (() => {
          throw new Error("ALGO stake amount is too large for this client.");
        })()
      : Number(input.algoMicroAlgos);

  const appl = algosdk.makeApplicationCallTxnFromObject({
    sender: input.senderAddr,
    appIndex: binding.appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [enc.encode("mint"), algosdk.encodeUint64(mintAmt)],
    accounts: [...binding.nodeAccounts],
    foreignAssets: [binding.talgoAssetId],
    suggestedParams: {
      ...input.suggestedParams,
      flatFee: true,
      fee: 0n,
    },
  });

  out.push(pay, appl);
  return { unsigned: out };
}
