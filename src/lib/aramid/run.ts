import { decodeAddress as decodeAvmAddress, waitForConfirmation } from "algosdk";
import {
  createPublicClient,
  encodeFunctionData,
  fallback,
  getAddress,
  http,
  isAddress,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import {
  aramidTransferNote,
  avmAlgod,
  buildAlgorandOptInTxn,
  buildAvmBridgeTxn,
} from "@/lib/aramid/avm";
import { findAramidClaim } from "@/lib/aramid/claim";
import { loadAramidConfig } from "@/lib/aramid/config";
import {
  ARAMID_EVM_BRIDGE,
  encodeLockNative,
  encodeLockTokens,
  erc20ApproveAbi,
  isNativeEthToken,
  releaseTokensAbi,
} from "@/lib/aramid/evm";
import { computeAramidAmounts, humanToBaseUnits } from "@/lib/aramid/fees";
import { isAvmChain } from "@/lib/aramid/routes";
import {
  ARAMID_CHAIN,
  type AramidChainId,
  type AramidRoute,
} from "@/lib/aramid/types";
const baseClient = createPublicClient({
  chain: base,
  transport: fallback([
    http("https://mainnet.base.org"),
    http("https://base.publicnode.com"),
  ]),
});

const BRIDGE_NOTE = "dorkfi";

const erc20BalanceOfAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const erc20AllowanceAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type AvmSignFn = (unsigned: Uint8Array[]) => Promise<Uint8Array[]>;

export type EvmSendFn = (
  input: {
    to: string;
    data?: Hex;
    value?: bigint;
    chainId?: number;
  },
  options?: { address?: string }
) => Promise<{ hash: Hex }>;

export type AramidBridgeStep =
  | "preparing"
  | "opting-in"
  | "approving"
  | "signing"
  | "confirming"
  | "claiming";

function asBig(amount: string): bigint {
  return BigInt(amount);
}

function missingAccount(error: unknown): boolean {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: number }).status)
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return status === 404 || /not found|no such/i.test(message);
}

function requireAvmAddress(address: string, label: string): string {
  const trimmed = address.trim();
  try {
    decodeAvmAddress(trimmed);
    return trimmed;
  } catch {
    throw new Error(`Enter a valid ${label} address.`);
  }
}

function requireEvmAddress(address: string, label: string): `0x${string}` {
  const trimmed = address.trim();
  if (!isAddress(trimmed)) {
    throw new Error(`Enter a valid ${label} address.`);
  }
  return getAddress(trimmed);
}

async function assertDestinationLiquidity(
  route: AramidRoute,
  destinationAmount: bigint
): Promise<void> {
  const config = await loadAramidConfig();
  const bridge = config.chains[String(route.destinationChain)]?.address;
  if (!bridge) throw new Error("Destination bridge address is missing.");
  if (isAvmChain(route.destinationChain)) {
    const algod = avmAlgod(route.destinationChain);
    if (/^\d+$/.test(route.destinationToken) && route.destinationToken !== "0") {
      const assetId = Number(route.destinationToken);
      try {
        const info = await algod.accountAssetInformation(bridge, assetId).do();
        const holding = info as {
          assetHolding?: { amount?: number | bigint };
          "asset-holding"?: { amount?: number | bigint };
        };
        const raw =
          holding.assetHolding?.amount ?? holding["asset-holding"]?.amount ?? 0;
        if (BigInt(raw) < destinationAmount) {
          throw new Error(
            "The bridge does not have enough of that asset on the destination yet."
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("does not have enough")) {
          throw error;
        }
        throw new Error(
          "The bridge does not have enough of that asset on the destination yet."
        );
      }
      return;
    }
    const info = await algod.accountInformation(bridge).do();
    const row = info as { amount?: number | bigint };
    if (BigInt(row.amount ?? 0) < destinationAmount) {
      throw new Error(
        "The bridge does not have enough of that asset on the destination yet."
      );
    }
    return;
  }

  const bridgeAddress = getAddress(bridge);
  const available = isNativeEthToken(route.destinationToken)
    ? await baseClient.getBalance({ address: bridgeAddress })
    : await baseClient.readContract({
        address: getAddress(route.destinationToken),
        abi: erc20BalanceOfAbi,
        functionName: "balanceOf",
        args: [bridgeAddress],
      });
  if (available < destinationAmount) {
    throw new Error(
      "The bridge does not have enough of that asset on the destination yet."
    );
  }
}

async function ensureAlgorandOptIn(args: {
  destinationAddress: string;
  assetId: number;
  signAvm?: AvmSignFn;
  canOptIn: boolean;
  onProgress?: (step: AramidBridgeStep) => void;
}): Promise<void> {
  if (args.assetId <= 0) return;
  const algod = avmAlgod(ARAMID_CHAIN.algorand);
  try {
    await algod.accountAssetInformation(args.destinationAddress, args.assetId).do();
    return;
  } catch (error) {
    if (!missingAccount(error)) throw error;
  }
  if (!args.canOptIn || !args.signAvm) {
    throw new Error(
      "That Algorand account needs to opt in to the asset before it can receive this bridge."
    );
  }
  args.onProgress?.("opting-in");
  const txn = await buildAlgorandOptInTxn({
    from: args.destinationAddress,
    assetId: args.assetId,
  });
  const signed = await args.signAvm([txn.toByte()]);
  const sent = await algod.sendRawTransaction(signed[0]).do();
  await waitForConfirmation(algod, sent.txid, 8);
}

async function sendEvmAndWait(args: {
  sendEvm: EvmSendFn;
  evmAddress?: string;
  to: string;
  data?: Hex;
  value?: bigint;
}): Promise<Hex> {
  const { hash } = await args.sendEvm(
    {
      to: args.to,
      data: args.data,
      value: args.value ?? 0n,
      chainId: base.id,
    },
    args.evmAddress ? { address: args.evmAddress } : undefined
  );
  await baseClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function claimAramidOnBase(args: {
  sourceTransactionId: string;
  sendEvm: EvmSendFn;
  evmAddress?: string;
  onProgress?: (step: AramidBridgeStep) => void;
}): Promise<string | undefined> {
  const config = await loadAramidConfig();
  const claims = config.addresses?.claims;
  if (!claims) return undefined;
  args.onProgress?.("claiming");
  let claim = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    claim = await findAramidClaim({
      claimsAddress: claims,
      sourceTransactionId: args.sourceTransactionId,
    });
    if (claim) break;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  if (!claim) return undefined;
  const data = encodeFunctionData({
    abi: releaseTokensAbi,
    functionName: "releaseTokens",
    args: [
      BigInt(claim.maxClaimRound),
      claim.sourceTransactionId,
      {
        chainId: claim.sourceChainData.chainId,
        tokenId: claim.sourceChainData.tokenId,
        amount: BigInt(claim.sourceChainData.amount),
        addressId: claim.sourceChainData.addressId,
      },
      {
        chainId: claim.destinationChainData.chainId,
        tokenId: getAddress(claim.destinationChainData.tokenId),
        amount: BigInt(claim.destinationChainData.amount),
        addressId: getAddress(claim.destinationChainData.addressId),
      },
      claim.note ?? "",
      claim.signatures as Hex[],
    ],
  });
  const hash = await sendEvmAndWait({
    sendEvm: args.sendEvm,
    evmAddress: args.evmAddress,
    to: ARAMID_EVM_BRIDGE,
    data,
    value: 0n,
  });
  return hash;
}

export async function runAramidBridge(args: {
  route: AramidRoute;
  humanAmount: string;
  sender: string;
  destinationAddress: string;
  signAvm?: AvmSignFn;
  sendEvm?: EvmSendFn;
  evmAddress?: string;
  /** xChain and an Algorand-connected wallet can opt the destination in. */
  canOptInAlgorand: boolean;
  onProgress?: (step: AramidBridgeStep) => void;
}): Promise<{ sourceTxId: string; claimTxId?: string }> {
  args.onProgress?.("preparing");
  const total = humanToBaseUnits(args.humanAmount, args.route.sourceDecimals);
  const amounts = computeAramidAmounts({
    totalAmount: total,
    sourceDecimals: args.route.sourceDecimals,
    destinationDecimals: args.route.destinationDecimals,
    fee: args.route.fee,
    avmToAvm:
      isAvmChain(args.route.sourceChain) &&
      isAvmChain(args.route.destinationChain),
  });
  const destinationAmount = asBig(amounts.destinationAmount);
  await assertDestinationLiquidity(args.route, destinationAmount);

  const destinationAddress = isAvmChain(args.route.destinationChain)
    ? requireAvmAddress(args.destinationAddress, "destination")
    : requireEvmAddress(args.destinationAddress, "Base");

  if (
    args.route.destinationChain === ARAMID_CHAIN.algorand &&
    /^\d+$/.test(args.route.destinationToken) &&
    args.route.destinationToken !== "0"
  ) {
    await ensureAlgorandOptIn({
      destinationAddress,
      assetId: Number(args.route.destinationToken),
      signAvm: args.signAvm,
      canOptIn: args.canOptInAlgorand,
      onProgress: args.onProgress,
    });
  }

  if (isAvmChain(args.route.sourceChain)) {
    if (!args.signAvm) throw new Error("Connect a wallet that can sign this network.");
    const sender = requireAvmAddress(args.sender, "sender");
    args.onProgress?.("signing");
    const note = aramidTransferNote({
      destinationNetwork: args.route.destinationChain,
      destinationAddress,
      destinationToken: args.route.destinationToken,
      feeAmount: amounts.feeAmount,
      sourceAmount: amounts.sourceAmount,
      destinationAmount: amounts.destinationAmount,
      note: BRIDGE_NOTE,
    });
    const txn = await buildAvmBridgeTxn({
      chainId: args.route.sourceChain as AramidChainId,
      from: sender,
      bridgeAddress: args.route.bridgeAddress,
      assetId: /^\d+$/.test(args.route.sourceToken)
        ? Number(args.route.sourceToken)
        : 0,
      totalAmount: asBig(amounts.totalAmount),
      note,
    });
    const signed = await args.signAvm([txn.toByte()]);
    args.onProgress?.("confirming");
    const algod = avmAlgod(args.route.sourceChain);
    const sent = await algod.sendRawTransaction(signed[0]).do();
    await waitForConfirmation(algod, sent.txid, 12);
    let claimTxId: string | undefined;
    if (args.route.destinationChain === ARAMID_CHAIN.base && args.sendEvm) {
      claimTxId = await claimAramidOnBase({
        sourceTransactionId: sent.txid,
        sendEvm: args.sendEvm,
        evmAddress: args.evmAddress,
        onProgress: args.onProgress,
      });
    }
    return { sourceTxId: sent.txid, claimTxId };
  }

  if (!args.sendEvm) {
    throw new Error("Base transfers use the Easy Start wallet.");
  }
  const sender = requireEvmAddress(args.sender, "Base");
  const token = isNativeEthToken(args.route.sourceToken)
    ? (`${"0x"}${"0".repeat(40)}` as `0x${string}`)
    : getAddress(args.route.sourceToken);
  const feeAmount = asBig(amounts.feeAmount);
  const rootAmount = asBig(amounts.sourceAmount);
  const totalAmount = asBig(amounts.totalAmount);
  const destination = {
    chainId: args.route.destinationChain,
    tokenId: args.route.destinationToken,
    amount: destinationAmount,
    addressId: destinationAddress,
  };

  if (!isNativeEthToken(args.route.sourceToken)) {
    const allowance = await baseClient.readContract({
      address: token,
      abi: erc20AllowanceAbi,
      functionName: "allowance",
      args: [sender, getAddress(args.route.bridgeAddress)],
    });
    if (allowance < totalAmount) {
      args.onProgress?.("approving");
      await sendEvmAndWait({
        sendEvm: args.sendEvm,
        evmAddress: args.evmAddress,
        to: token,
        data: encodeFunctionData({
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [getAddress(args.route.bridgeAddress), totalAmount],
        }),
        value: 0n,
      });
    }
  }

  args.onProgress?.("signing");
  const data = isNativeEthToken(args.route.sourceToken)
    ? encodeLockNative({
        token,
        feeAmount,
        rootAmount,
        destination,
        note: BRIDGE_NOTE,
      })
    : encodeLockTokens({
        token,
        feeAmount,
        rootAmount,
        destination,
        note: BRIDGE_NOTE,
      });
  const hash = await sendEvmAndWait({
    sendEvm: args.sendEvm,
    evmAddress: args.evmAddress,
    to: getAddress(args.route.bridgeAddress),
    data,
    value: isNativeEthToken(args.route.sourceToken) ? totalAmount : 0n,
  });
  return { sourceTxId: hash };
}
