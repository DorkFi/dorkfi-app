/**
 * Best-effort single-signature cross-asset repay:
 * Haystack swap + DorkFi repay in one Algorand atomic group via SwapComposer.
 *
 * Falls back to the caller’s sequential swap→repay when the group does not fit
 * or combined simulation fails (common when resource-sharing beacons are required
 * in shapes we cannot yet reconstruct).
 */
import algosdk, { type Transaction } from "algosdk";
import BigNumber from "bignumber.js";
import { abi, CONTRACT } from "ulujs";
import type { Wallet } from "@txnlab/use-wallet-react";
import { RouterClient } from "@txnlab/haystack-router";
import {
  APP_SPEC as LendingPoolAppSpec,
} from "@/clients/DorkFiLendingPoolClient";
import {
  getAlgorandNetworkFromNetworkId,
  getNetworkConfig,
  getTokenAdaptersForPhase,
  isAlgorandCompatibleNetwork,
  resolveRepayFolksAdapter,
  resolveTokenConfigFromDisplayToken,
  tokenStandardIsFolksAsaBridge,
  tokenStandardUsesAsaStyleNt200Txns,
  type NetworkId,
  type TokenStandard,
} from "@/config";
import algorandService, {
  type AlgorandNetwork,
} from "@/services/algorandService";
import {
  asSdkQuote,
  getHaystackSdkApiBaseUrl,
  pickSwapTxIdFromComposer,
} from "@/services/haystackSwapExecute";
import {
  fetchHaystackQuote,
  type HaystackQuoteResponse,
} from "@/services/haystackRouterService";
import {
  fetchMarketInfo,
  resolveDisplayTokenForPoolMarket,
} from "@/services/lendingService";
import { withRainbowkitHostDialogDismissed } from "@/wallet/xchainSignUi";

/**
 * Slots reserved for repay (+ GRS beacons) when requesting Haystack routes.
 * ALGO→WAD multi-hop routes often use 8 txns at maxGroupSize 10, which leaves
 * too little room for arc200 redeem + approve + repay + custom + GRS (≤16).
 * Budget 10 → maxGroupSize 6 keeps swaps compact (~6 txns) so one signature fits.
 */
export const HAYSTACK_REPAY_GROUP_BUDGET = 10;

/** maxGroupSize passed to Haystack so SwapComposer can append repay. */
export function haystackRepayMaxGroupSize(): number {
  return 16 - HAYSTACK_REPAY_GROUP_BUDGET;
}

const MAINNET_BEACON_ID = 3209233839;
const BEACON_NOP_SEL = "58759fa2";

export type AtomicRepayResult =
  | { ok: true; txId: string }
  | { ok: false; reason: string };

function cloneClearGroup(txn: Transaction): Transaction {
  const copy = algosdk.decodeUnsignedTransaction(
    algosdk.encodeUnsignedTransaction(txn)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (copy as any).group;
  return copy;
}

function appAddress(appIndex: number): string {
  return algosdk.encodeAddress(
    algosdk.getApplicationAddress(appIndex).publicKey
  );
}

/** Expand arccjs-style extraTxn rows into algosdk Transactions (no GRS). */
function expandExtraTxns(
  extras: Record<string, unknown>[],
  params: algosdk.SuggestedParams,
  sender: string
): Transaction[] {
  const out: Transaction[] = [];
  for (const txn of extras) {
    if (txn.ignore) continue;
    const fee = Number(txn.fee ?? 1000);
    const sp = { ...params, flatFee: true as const, fee: BigInt(fee) };
    const appIndex = Number(txn.appIndex);
    const note =
      txn.note instanceof Uint8Array
        ? txn.note
        : undefined;

    const xaid = txn.xaid != null ? Number(txn.xaid) : 0;
    const aamt = txn.aamt != null ? BigInt(String(txn.aamt)) : null;
    const payment = txn.payment != null ? BigInt(String(txn.payment)) : null;
    const snd = typeof txn.snd === "string" ? txn.snd : sender;
    const arcv = typeof txn.arcv === "string" ? txn.arcv : null;

    // Standalone opt-in axfer
    if (xaid > 0 && snd && arcv && snd === arcv && aamt == null && !payment) {
      out.push(
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: snd,
          receiver: arcv,
          amount: 0,
          assetIndex: xaid,
          suggestedParams: { ...params, flatFee: true, fee: 1000n },
          note,
        })
      );
      continue;
    }

    if (payment != null && payment > 0n && Number.isFinite(appIndex)) {
      out.push(
        algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender,
          receiver: appAddress(appIndex),
          amount: payment,
          suggestedParams: { ...params, flatFee: true, fee: 1000n },
          note: txn.paymentNote instanceof Uint8Array ? txn.paymentNote : note,
        })
      );
    }

    if (xaid > 0 && aamt != null && aamt > 0n && Number.isFinite(appIndex)) {
      out.push(
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender,
          receiver: appAddress(appIndex),
          amount: aamt,
          assetIndex: xaid,
          suggestedParams: { ...params, flatFee: true, fee: 1000n },
          note,
        })
      );
    }

    if (Number.isFinite(appIndex) && appIndex > 0) {
      out.push(
        algosdk.makeApplicationCallTxnFromObject({
          sender,
          appIndex,
          onComplete: algosdk.OnApplicationComplete.NoOpOC,
          appArgs: Array.isArray(txn.appArgs)
            ? (txn.appArgs as Uint8Array[])
            : [],
          accounts: Array.isArray(txn.accounts)
            ? (txn.accounts as string[])
            : [],
          foreignApps: Array.isArray(txn.foreignApps)
            ? (txn.foreignApps as number[]).map(Number)
            : [],
          foreignAssets: Array.isArray(txn.foreignAssets)
            ? (txn.foreignAssets as number[]).map(Number)
            : [],
          boxes: Array.isArray(txn.boxes)
            ? (txn.boxes as { appIndex: number; name: Uint8Array }[])
            : [],
          suggestedParams: sp,
          note,
        })
      );
    }
  }
  return out;
}

function makeCustomAppCall(
  poolId: number,
  sender: string,
  params: algosdk.SuggestedParams
): Transaction {
  const contract = new algosdk.ABIContract(abi.custom);
  const method = contract.getMethodByName("custom");
  return algosdk.makeApplicationCallTxnFromObject({
    sender,
    appIndex: poolId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [method.getSelector()],
    suggestedParams: {
      ...params,
      flatFee: true,
      fee: 100_000n,
    },
  });
}

type Ura = {
  accounts?: string[];
  apps?: (number | bigint)[];
  assets?: (number | bigint)[];
  assetHoldings?: { account: string; asset: number | bigint }[];
  appLocals?: { account: string; app: number | bigint }[];
  boxes?: { app: number | bigint; name: Uint8Array }[];
};

function buildBeaconGrsTxns(
  ura: Ura | undefined,
  sender: string,
  params: algosdk.SuggestedParams,
  beaconId: number
): Transaction[] {
  if (!ura) return [];
  const out: Transaction[] = [];
  const nop = new Uint8Array(Buffer.from(BEACON_NOP_SEL, "hex"));
  const baseSp = { ...params, flatFee: true as const, fee: 1000n };

  const assetHoldings = ura.assetHoldings ?? [];
  for (let i = 0; i < assetHoldings.length; i += 4) {
    const group = assetHoldings.slice(i, i + 4);
    const assets = [...new Set(group.map((h) => Number(h.asset)))];
    const accounts = [...new Set(group.map((h) => h.account))];
    out.push(
      algosdk.makeApplicationCallTxnFromObject({
        sender,
        appIndex: beaconId,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs: [nop],
        accounts,
        foreignAssets: assets,
        suggestedParams: baseSp,
      })
    );
  }

  const appLocals = ura.appLocals ?? [];
  for (let i = 0; i < appLocals.length; i += 4) {
    const group = appLocals.slice(i, i + 4);
    const apps = [...new Set(group.map((h) => Number(h.app)))];
    const accounts = [...new Set(group.map((h) => h.account))];
    out.push(
      algosdk.makeApplicationCallTxnFromObject({
        sender,
        appIndex: beaconId,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs: [nop],
        accounts,
        foreignApps: apps,
        suggestedParams: baseSp,
      })
    );
  }

  const accounts = ura.accounts ?? [];
  const apps = (ura.apps ?? []).map(Number);
  const assets = (ura.assets ?? []).map(Number);
  for (let i = 0; i < accounts.length; i += 4) {
    out.push(
      algosdk.makeApplicationCallTxnFromObject({
        sender,
        appIndex: beaconId,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        appArgs: [nop],
        accounts: accounts.slice(i, i + 4),
        foreignApps: apps,
        foreignAssets: assets,
        suggestedParams: baseSp,
      })
    );
  }

  const boxNames = new Map<number, Uint8Array[]>();
  for (const box of ura.boxes ?? []) {
    const app = Number(box.app);
    if (!boxNames.has(app)) boxNames.set(app, []);
    boxNames.get(app)!.push(box.name);
  }
  for (const [app, names] of boxNames) {
    for (let i = 0; i < names.length; i += 7) {
      const slice = names.slice(i, i + 7);
      out.push(
        algosdk.makeApplicationCallTxnFromObject({
          sender,
          appIndex: beaconId,
          onComplete: algosdk.OnApplicationComplete.NoOpOC,
          appArgs: [nop],
          foreignApps: [app],
          boxes: slice.map((name) => ({ appIndex: app, name })),
          suggestedParams: baseSp,
        })
      );
    }
  }

  return out;
}

async function simulateUnsignedGroup(
  algod: algosdk.Algodv2,
  txns: Transaction[]
): Promise<{ ok: boolean; ura?: Ura; failure?: string }> {
  if (txns.length === 0 || txns.length > 16) {
    return { ok: false, failure: `invalid group size ${txns.length}` };
  }
  const grouped = txns.map(cloneClearGroup);
  algosdk.assignGroupID(grouped);
  const signed = grouped.map((t) => {
    const encoded = algosdk.encodeUnsignedSimulateTransaction(t);
    return algosdk.decodeSignedTransaction(encoded);
  });
  const request = new algosdk.modelsv2.SimulateRequest({
    txnGroups: [
      new algosdk.modelsv2.SimulateRequestTransactionGroup({ txns: signed }),
    ],
    allowEmptySignatures: true,
    allowUnnamedResources: true,
    fixSigners: true,
  });
  const response = await algod.simulateTransactions(request).do();
  const group = response.txnGroups?.[0];
  const failure = group?.failureMessage;
  if (failure) {
    return { ok: false, failure: String(failure) };
  }
  return {
    ok: true,
    ura: group?.unnamedResourcesAccessed as unknown as Ura | undefined,
  };
}

type RepayExtrasVariant = {
  extras: Record<string, unknown>[];
  poolIdNum: number;
  params: algosdk.SuggestedParams;
};

/**
 * Build all createBalanceBox / approve-payment variants (same order as
 * `lendingService.repay`). Callers must try each until simulation succeeds —
 * do not take only the first.
 */
async function buildRepayExtrasVariants(args: {
  poolId: string;
  marketId: string;
  tokenStandard: TokenStandard;
  amount: string;
  userAddress: string;
  networkId: NetworkId;
  repayAdapterId?: string;
}): Promise<RepayExtrasVariant[]> {
  const networkConfig = getNetworkConfig(args.networkId);
  if (!isAlgorandCompatibleNetwork(args.networkId)) {
    throw new Error("Atomic cross-asset repay requires Algorand");
  }
  const clients = await algorandService.initializeClientsForReads(
    networkConfig.walletNetworkId as AlgorandNetwork
  );
  const params = await clients.algod.getTransactionParams().do();

  const token = resolveDisplayTokenForPoolMarket(
    args.networkId,
    args.poolId,
    args.marketId
  );
  if (!token) throw new Error("Token not found for repay");

  const tokenConfigForRepay = resolveTokenConfigFromDisplayToken(
    args.networkId,
    token
  );
  const repayPhaseAdapters = tokenConfigForRepay
    ? getTokenAdaptersForPhase(tokenConfigForRepay, "repay")
    : [];
  const folksForRepay = resolveRepayFolksAdapter(
    tokenConfigForRepay ?? {},
    args.repayAdapterId
  );

  if (
    tokenStandardIsFolksAsaBridge(args.tokenStandard) &&
    repayPhaseAdapters.length > 0 &&
    !folksForRepay
  ) {
    throw new Error("Folks repay adapter required for this market");
  }

  let nt200RepayAxferXaid =
    token.underlyingAssetId != null &&
    String(token.underlyingAssetId).trim() !== ""
      ? Number(token.underlyingAssetId)
      : NaN;

  // Cross-asset uses market_token (or non-Folks ASA) — no Folks mint preamble.
  if (folksForRepay) {
    if (folksForRepay.repayWalletBasis !== "market_token") {
      throw new Error(
        "Atomic cross-asset repay requires market_token Folks adapter"
      );
    }
    const fp = folksForRepay.folksParams;
    if (tokenStandardUsesAsaStyleNt200Txns(args.tokenStandard)) {
      const fAsa = Number(fp.fAssetId);
      if (!Number.isFinite(fAsa) || fAsa <= 0) {
        throw new Error("Invalid Folks fAssetId for repay");
      }
      nt200RepayAxferXaid = fAsa;
    }
  }

  const repayArc200Units = BigInt(
    new BigNumber(args.amount)
      .multipliedBy(10 ** token.decimals)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toFixed(0)
  );
  if (repayArc200Units <= 0n) {
    throw new Error("Repay amount must be positive");
  }

  const marketInfo = await fetchMarketInfo(
    args.poolId,
    args.marketId,
    args.networkId
  );
  if (!marketInfo) throw new Error("Failed to fetch market info");

  const builder = {
    lending: new CONTRACT(
      Number(args.poolId),
      clients.algod,
      undefined,
      { ...LendingPoolAppSpec.contract, events: [] },
      { addr: args.userAddress, sk: new Uint8Array() },
      true,
      false,
      true
    ),
    token: new CONTRACT(
      Number(token.underlyingContractId),
      clients.algod,
      undefined,
      abi.nt200,
      { addr: args.userAddress, sk: new Uint8Array() },
      true,
      false,
      true
    ),
    arc200Exchange: new CONTRACT(
      Number(token.underlyingContractId),
      clients.algod,
      undefined,
      {
        name: "arc200Exchange",
        desc: "arc200Exchange",
        methods: [
          {
            name: "arc200_redeem",
            args: [{ name: "amount", type: "uint64" }],
            returns: { type: "void" },
          },
        ],
        events: [],
      },
      { addr: args.userAddress, sk: new Uint8Array() },
      true,
      false,
      true
    ),
  };

  const symbol = token.symbol;
  const enc = new TextEncoder();
  const variants: RepayExtrasVariant[] = [];

  for (const [p1, p2] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const) {
    const buildN: Record<string, unknown>[] = [];

    if (args.tokenStandard === "network") {
      if (p1 > 0) {
        const txnO = (await builder.token.createBalanceBox(args.userAddress))
          .obj;
        buildN.push({
          ...txnO,
          payment: 28500,
          note: enc.encode("nt200 createBalanceBox"),
        });
      }
      {
        const txnO = (await builder.token.deposit(repayArc200Units)).obj;
        buildN.push({
          ...txnO,
          note: enc.encode("nt200 deposit"),
          payment: repayArc200Units,
        });
      }
    } else if (tokenStandardUsesAsaStyleNt200Txns(args.tokenStandard)) {
      if (p1 > 0) {
        const txnO = (await builder.token.createBalanceBox(args.userAddress))
          .obj;
        buildN.push({
          ...txnO,
          payment: 28501,
          note: enc.encode(
            `nt200 createBalanceBox arc200 ${symbol} token for ${args.userAddress}`
          ),
        });
      }
      {
        const txnO = (await builder.token.deposit(repayArc200Units)).obj;
        buildN.push({
          ...txnO,
          aamt: repayArc200Units,
          xaid: nt200RepayAxferXaid,
          note: enc.encode(
            `nt200 deposit ${symbol} token for user (${args.userAddress})`
          ),
        });
      }
    } else if (args.tokenStandard === "arc200-exchange") {
      const txnO = (
        await builder.arc200Exchange.arc200_redeem(repayArc200Units)
      ).obj;
      buildN.push({
        ...txnO,
        aamt: repayArc200Units,
        xaid: Number(token.underlyingAssetId),
        note: enc.encode("arc200_redeem"),
      });
    } else {
      throw new Error(
        `Atomic cross-asset repay does not support tokenStandard=${args.tokenStandard}`
      );
    }

    {
      const addr = appAddress(Number(args.poolId));
      const txnO = (
        await builder.token.arc200_approve(addr, repayArc200Units)
      ).obj;
      buildN.push({
        ...txnO,
        note: enc.encode(
          `arc200 approve ${symbol} token spending to pool (${addr}) for user (${args.userAddress})`
        ),
        payment: p2 > 0 ? 28502 : 0,
      });
    }
    {
      const txnO = (
        await builder.lending.repay(Number(args.marketId), repayArc200Units)
      ).obj as Record<string, unknown>;
      buildN.push({
        ...txnO,
        payment: 1e5,
        note: enc.encode("lending repay"),
      });
    }

    variants.push({
      extras: buildN,
      poolIdNum: Number(args.poolId),
      params,
    });
  }

  if (variants.length === 0) {
    throw new Error("Failed to build repay extras");
  }
  return variants;
}

/**
 * Build repay Transactions that simulate successfully when prepended with
 * Haystack swap funding txns. Returns group-cleared repay-side txns only.
 */
export async function buildRepayTxnsForHaystackFunding(args: {
  poolId: string;
  marketId: string;
  tokenStandard: TokenStandard;
  amount: string;
  userAddress: string;
  networkId: NetworkId;
  repayAdapterId?: string;
  fundingSwapTxns: Transaction[];
}): Promise<Transaction[]> {
  const variants = await buildRepayExtrasVariants(args);

  const aln = getAlgorandNetworkFromNetworkId(args.networkId);
  if (!aln) throw new Error("Invalid Algorand network");
  const { algod } = await algorandService.initializeClientsForReads(
    aln as AlgorandNetwork
  );

  const funding = args.fundingSwapTxns.map(cloneClearGroup);
  const beaconId =
    args.networkId === "algorand-mainnet" ? MAINNET_BEACON_ID : 376092;

  let lastFailure = "Combined swap+repay simulation failed";

  for (const { extras, poolIdNum, params } of variants) {
    const core = [
      ...expandExtraTxns(extras, params, args.userAddress),
      makeCustomAppCall(poolIdNum, args.userAddress, params),
    ];

    const first = await simulateUnsignedGroup(algod, [...funding, ...core]);
    if (!first.ok) {
      lastFailure = first.failure || lastFailure;
      continue;
    }

    const grs = buildBeaconGrsTxns(
      first.ura,
      args.userAddress,
      params,
      beaconId
    );
    const repaySide = [...grs, ...core].map(cloneClearGroup);
    const total = funding.length + repaySide.length;

    if (total > 16) {
      lastFailure = `Atomic group would be ${total} txns (max 16; swap=${funding.length}, repay=${repaySide.length})`;
      continue;
    }

    const second = await simulateUnsignedGroup(algod, [
      ...funding,
      ...repaySide,
    ]);
    if (!second.ok) {
      lastFailure = second.failure || "Combined swap+repay+GRS simulation failed";
      continue;
    }

    return repaySide;
  }

  throw new Error(lastFailure);
}

function createRouter(): RouterClient {
  return new RouterClient({
    apiKey: "dorkfi-browser-proxy",
    apiBaseUrl: getHaystackSdkApiBaseUrl(),
  });
}

async function executeAtomicWithQuote(args: {
  address: string;
  quote: HaystackQuoteResponse;
  slippagePercent: number;
  transactionSigner: (
    txnGroup: Transaction[],
    indexesToSign: number[]
  ) => Promise<Uint8Array[]>;
  activeWallet: Wallet | null | undefined;
  setRainbowkitSuppressed?: (v: boolean) => void;
  poolId: string;
  marketId: string;
  tokenStandard: TokenStandard;
  amount: string;
  networkId: NetworkId;
  repayAdapterId?: string;
}): Promise<AtomicRepayResult> {
  if (!args.quote?.txnPayload) {
    return { ok: false, reason: "missing Haystack txnPayload" };
  }

  const router = createRouter();
  const probe = await router.newSwap({
    quote: asSdkQuote(args.quote),
    address: args.address,
    slippage: args.slippagePercent,
    signer: args.transactionSigner,
  });
  await probe.addSwapTransactions();
  const fundingSwapTxns = probe.buildGroup().map((x) => cloneClearGroup(x.txn));

  const repayTxns = await buildRepayTxnsForHaystackFunding({
    poolId: args.poolId,
    marketId: args.marketId,
    tokenStandard: args.tokenStandard,
    amount: args.amount,
    userAddress: args.address,
    networkId: args.networkId,
    repayAdapterId: args.repayAdapterId,
    fundingSwapTxns,
  });

  if (fundingSwapTxns.length + repayTxns.length > 16) {
    return {
      ok: false,
      reason: `group too large (${fundingSwapTxns.length + repayTxns.length})`,
    };
  }

  const execComposer = await router.newSwap({
    quote: asSdkQuote(args.quote),
    address: args.address,
    slippage: args.slippagePercent,
    signer: args.transactionSigner,
  });

  const result = await withRainbowkitHostDialogDismissed({
    wallet: args.activeWallet,
    setSuppressed: args.setRainbowkitSuppressed ?? (() => {}),
    leaveOverlayDismissedOnSuccess: true,
    run: async () => {
      await execComposer.addSwapTransactions();
      for (const txn of repayTxns) {
        execComposer.addTransaction(cloneClearGroup(txn));
      }
      return execComposer.execute();
    },
  });

  const txId =
    pickSwapTxIdFromComposer(result, execComposer) ?? result?.txIds?.[0];
  if (!txId) {
    return { ok: false, reason: "atomic execute returned no tx id" };
  }
  return { ok: true, txId };
}

function isUserWalletRejection(reason: string): boolean {
  return /reject|denied|cancell?ed|abort|user.?dismiss/i.test(reason);
}

async function fetchCompactRepayQuote(args: {
  quote: HaystackQuoteResponse;
  amount: string;
  poolId: string;
  marketId: string;
  networkId: NetworkId;
}): Promise<HaystackQuoteResponse | null> {
  const fromASAID = Number(args.quote.fromASAID);
  const toASAID = Number(args.quote.toASAID);
  if (!Number.isFinite(fromASAID) || !Number.isFinite(toASAID)) return null;

  const token = resolveDisplayTokenForPoolMarket(
    args.networkId,
    args.poolId,
    args.marketId
  );
  if (!token) return null;

  const debtAtomic = BigInt(
    new BigNumber(args.amount)
      .multipliedBy(10 ** token.decimals)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toFixed(0)
  );

  return fetchHaystackQuote({
    type: "fixed-output",
    amount: debtAtomic,
    fromASAID,
    toASAID,
    maxGroupSize: haystackRepayMaxGroupSize(),
    disabledProtocols: ["Humble"],
  });
}

/**
 * Attempt one-signature Haystack swap + DorkFi repay.
 * On any failure, returns `{ ok: false }` so the UI can fall back to two-step.
 */
export async function tryExecuteHaystackAtomicRepay(args: {
  address: string;
  quote: HaystackQuoteResponse;
  slippagePercent: number;
  transactionSigner: (
    txnGroup: Transaction[],
    indexesToSign: number[]
  ) => Promise<Uint8Array[]>;
  activeWallet: Wallet | null | undefined;
  setRainbowkitSuppressed?: (v: boolean) => void;
  poolId: string;
  marketId: string;
  tokenStandard: TokenStandard;
  amount: string;
  networkId: NetworkId;
  repayAdapterId?: string;
}): Promise<AtomicRepayResult> {
  const attempt = async (
    quote: HaystackQuoteResponse
  ): Promise<AtomicRepayResult> => {
    try {
      return await executeAtomicWithQuote({ ...args, quote });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "atomic repay failed";
      return { ok: false, reason };
    }
  };

  const first = await attempt(args.quote);
  if (first.ok) return first;

  // Wallet prompt already shown / user dismissed — do not refetch & re-prompt.
  if (isUserWalletRejection(first.reason)) {
    console.warn(
      "[haystack atomic repay] falling back to two-step:",
      first.reason
    );
    return first;
  }

  console.warn(
    "[haystack atomic repay] compose failed; retrying compact quote:",
    first.reason
  );
  try {
    const compact = await fetchCompactRepayQuote(args);
    if (!compact?.txnPayload) {
      console.warn(
        "[haystack atomic repay] falling back to two-step:",
        first.reason
      );
      return first;
    }
    const second = await attempt(compact);
    if (!second.ok) {
      console.warn(
        "[haystack atomic repay] falling back to two-step:",
        second.reason
      );
    }
    return second;
  } catch (retryErr) {
    const reason =
      retryErr instanceof Error ? retryErr.message : first.reason;
    console.warn("[haystack atomic repay] falling back to two-step:", reason);
    return { ok: false, reason };
  }
}
