import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequired } from "@x402/core/types";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import type { ClientEvmSigner } from "@x402/evm";
import { getAddress, isAddress, type WalletClient } from "viem";

const CLAIMLAYER_WORKFLOW_ID = "claimlayer-paid-claimall";

const DEFAULT_NFT_CLAIM_AGENT_BASE =
  "https://claim-agent-production.up.railway.app/claim";

/**
 * NFT claim status agent must be fetched from a real origin (CORS on the agent),
 * not via a Vite dev proxy path like `/api/...`.
 */
function isLocalClaimAgentPort3001(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.port === "3001";
  } catch {
    return false;
  }
}

export function getNftHolderClaimAgentBase(): string {
  const raw = (import.meta.env.VITE_NFT_CLAIM_AGENT_BASE as string | undefined)?.trim();
  if (raw && isLocalClaimAgentPort3001(raw)) {
    console.warn(
      "[DorkFi] VITE_NFT_CLAIM_AGENT_BASE is localhost:3001; using production claim agent instead:",
      DEFAULT_NFT_CLAIM_AGENT_BASE
    );
  }
  const candidate =
    raw && isLocalClaimAgentPort3001(raw) ? DEFAULT_NFT_CLAIM_AGENT_BASE : raw || DEFAULT_NFT_CLAIM_AGENT_BASE;
  if (candidate.startsWith("/")) {
    console.warn(
      "[DorkFi] VITE_NFT_CLAIM_AGENT_BASE must be an absolute https:// URL, not a proxy path. Using default claim agent."
    );
    return DEFAULT_NFT_CLAIM_AGENT_BASE;
  }
  if (!/^https?:\/\//i.test(candidate)) {
    console.warn(
      "[DorkFi] VITE_NFT_CLAIM_AGENT_BASE must start with http:// or https://. Using default claim agent."
    );
    return DEFAULT_NFT_CLAIM_AGENT_BASE;
  }
  return candidate.replace(/\/+$/, "");
}

/**
 * `GET …/claim/:address/unsigned?relayer=` — relayer defaults to the beneficiary (same account) unless
 * `VITE_NFT_CLAIM_RELAYER_ADDRESS` is set (58-char AVM account).
 */
export function resolveNftHolderClaimRelayerAddress(beneficiaryAddress: string): string {
  const raw = (import.meta.env.VITE_NFT_CLAIM_RELAYER_ADDRESS as string | undefined)?.trim();
  if (raw) return raw;
  return beneficiaryAddress.trim();
}

export type NftHolderUnsignedClaimSlot = {
  campaignId?: string;
  campaignName?: string;
  owner?: string;
  collectionId?: number;
  tokenId?: string;
  dripContractId?: number;
  rewardTokenContractId?: number;
  rewardSymbol?: string;
  claimableRaw?: string;
  claimableDisplay?: string;
};

export type NftHolderUnsignedClaimTxnRow = {
  groupIndex: number;
  txnBase64: string;
  kind?: string;
  feeMicros?: string;
  summary?: string;
};

export type NftHolderUnsignedClaimResponse = {
  address: string;
  claimable: boolean;
  slot?: NftHolderUnsignedClaimSlot | null;
  transactions: NftHolderUnsignedClaimTxnRow[];
  errors: unknown[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseUnsignedClaimJson(json: unknown): NftHolderUnsignedClaimResponse {
  if (!isRecord(json)) {
    throw new Error("Invalid unsigned claim response: not an object");
  }
  const transactionsRaw = json.transactions;
  if (!Array.isArray(transactionsRaw)) {
    throw new Error("Invalid unsigned claim response: missing transactions[]");
  }
  const transactions: NftHolderUnsignedClaimTxnRow[] = [];
  for (const row of transactionsRaw) {
    if (!isRecord(row)) continue;
    const giRaw = row.groupIndex;
    const gi =
      typeof giRaw === "number"
        ? giRaw
        : typeof giRaw === "string"
          ? Number.parseInt(giRaw, 10)
          : NaN;
    const b64 = row.txnBase64;
    if (!Number.isFinite(gi) || typeof b64 !== "string" || !b64.trim()) continue;
    transactions.push({
      groupIndex: gi,
      txnBase64: b64.trim(),
      kind: typeof row.kind === "string" ? row.kind : undefined,
      feeMicros: typeof row.feeMicros === "string" ? row.feeMicros : undefined,
      summary: typeof row.summary === "string" ? row.summary : undefined,
    });
  }
  const addr = typeof json.address === "string" ? json.address : "";
  const claimable = typeof json.claimable === "boolean" ? json.claimable : false;
  const errors = Array.isArray(json.errors) ? json.errors : [];
  let slot: NftHolderUnsignedClaimSlot | null | undefined;
  if (json.slot === null) {
    slot = null;
  } else if (isRecord(json.slot)) {
    const s = json.slot;
    slot = {
      campaignId: typeof s.campaignId === "string" ? s.campaignId : undefined,
      campaignName: typeof s.campaignName === "string" ? s.campaignName : undefined,
      owner: typeof s.owner === "string" ? s.owner : undefined,
      collectionId: typeof s.collectionId === "number" ? s.collectionId : undefined,
      tokenId: typeof s.tokenId === "string" ? s.tokenId : undefined,
      dripContractId: typeof s.dripContractId === "number" ? s.dripContractId : undefined,
      rewardTokenContractId:
        typeof s.rewardTokenContractId === "number" ? s.rewardTokenContractId : undefined,
      rewardSymbol: typeof s.rewardSymbol === "string" ? s.rewardSymbol : undefined,
      claimableRaw: typeof s.claimableRaw === "string" ? s.claimableRaw : undefined,
      claimableDisplay: typeof s.claimableDisplay === "string" ? s.claimableDisplay : undefined,
    };
  }
  return { address: addr, claimable, slot, transactions, errors };
}

/**
 * Manual claim: unsigned transaction group from {@link getNftHolderClaimAgentBase}
 * (`GET …/claim/:address/unsigned?relayer=`).
 */
export async function fetchNftHolderUnsignedClaim(params: {
  beneficiaryAddress: string;
  relayerAddress: string;
}): Promise<NftHolderUnsignedClaimResponse> {
  const beneficiary = params.beneficiaryAddress.trim();
  const relayer = params.relayerAddress.trim();
  if (!beneficiary) {
    throw new Error("Missing portfolio address for unsigned claim");
  }
  if (!relayer) {
    throw new Error("Missing relayer address for unsigned claim");
  }
  const base = getNftHolderClaimAgentBase();
  const url = new URL(`${base}/${encodeURIComponent(beneficiary)}/unsigned`);
  url.searchParams.set("relayer", relayer);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Unsigned claim HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  return parseUnsignedClaimJson(json);
}

const DEFAULT_NFT_CLAIM_MANUAL_URL = "https://docs.dork.fi";

/**
 * URL for “claim manually” in the NFT rewards modal (opens in a new tab).
 * Set `VITE_NFT_CLAIM_MANUAL_URL` to an absolute `https://` page (e.g. docs or an external claim UI).
 */
export function getNftHolderClaimManualUrl(): string {
  const raw = (import.meta.env.VITE_NFT_CLAIM_MANUAL_URL as string | undefined)?.trim();
  if (raw && /^https?:\/\//i.test(raw) && !raw.startsWith("/")) {
    return raw.replace(/\/+$/, "");
  }
  return DEFAULT_NFT_CLAIM_MANUAL_URL;
}

export type ClaimlayerExecuteBody = {
  /**
   * AVM portfolio account (58-char Algorand / Voi) — claim beneficiary.
   * Workflow runners also require `algorandAddress` (same value).
   */
  address: string;
  /** Required workflow input: Algorand-format (or Voi) account the claim applies to. */
  algorandAddress: string;
  paymentAddress: `0x${string}`;
  /**
   * Gateway expects a checksummed Base (EVM) address here — same role as `paymentAddress` for x402.
   * (Sending a Voi/Algorand base32 account triggers "invalid request body" on strict validators.)
   */
  targetAddress: `0x${string}`;
  chain: string;
  targetChain: string;
  amount: string;
  txid?: string;
};

/** Pull a human-readable message from gateway JSON (Zod issues, generic error, etc.). */
function formatGatewayErrorMessage(status: number, json: unknown, fallbackText: string): string {
  if (!isRecord(json)) return fallbackText || `HTTP ${status}`;
  const parts: string[] = [];
  const err = json.error;
  const msg = json.message;
  if (typeof err === "string") parts.push(err);
  if (typeof msg === "string" && msg !== err) parts.push(msg);
  const issues = json.issues;
  if (Array.isArray(issues)) {
    for (const i of issues) {
      if (isRecord(i) && typeof i.message === "string") parts.push(i.message);
      else if (typeof i === "string") parts.push(i);
    }
  }
  const validation = json.validation;
  if (Array.isArray(validation)) {
    for (const i of validation) {
      if (isRecord(i) && typeof i.message === "string") parts.push(i.message);
    }
  }
  const errors = json.errors;
  if (Array.isArray(errors)) {
    for (const i of errors) {
      if (typeof i === "string") parts.push(i);
      else if (isRecord(i) && typeof i.msg === "string") parts.push(i.msg);
    }
  }
  const details = json.details;
  if (isRecord(details)) {
    for (const [key, val] of Object.entries(details)) {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "string") parts.push(`${key}: ${item}`);
        }
      } else if (typeof val === "string") {
        parts.push(`${key}: ${val}`);
      }
    }
  }
  const joined = parts.filter(Boolean).join(" — ");
  return joined || fallbackText || `HTTP ${status}`;
}

function isGatewayPaymentRequiredBody(
  status: number,
  json: unknown
): json is PaymentRequired & { code?: string } {
  if (!isRecord(json) || !Array.isArray(json.accepts)) return false;
  if (typeof json.x402Version !== "number") return false;
  if (status === 402) return true;
  return status === 400 && json.code === "PAYMENT_REQUIRED";
}

/**
 * Paid-workflow gateway (`lendpay-backend` / App Runner). Must be an absolute `https://` origin
 * (no trailing slash), not a Vite `/api/...` proxy path — the browser calls this host directly.
 */
export function getPaidWorkflowGatewayOrigin(): string | null {
  const raw = import.meta.env.VITE_PAID_WORKFLOW_GATEWAY_URL as string | undefined;
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (t.startsWith("/")) {
    console.warn(
      "[DorkFi] VITE_PAID_WORKFLOW_GATEWAY_URL must be an absolute https:// origin, not a proxy path:",
      t
    );
    return null;
  }
  if (!/^https?:\/\//i.test(t)) {
    console.warn(
      "[DorkFi] VITE_PAID_WORKFLOW_GATEWAY_URL must start with http:// or https://:",
      t
    );
    return null;
  }
  return t.replace(/\/+$/, "");
}

export function getClaimlayerUsdAmount(): string {
  const raw = import.meta.env.VITE_CLAIMLAYER_EXECUTE_USD_AMOUNT as string | undefined;
  return raw?.trim() || "0.10";
}

export function getClaimlayerTargetChain(): string {
  const raw = import.meta.env.VITE_CLAIMLAYER_TARGET_CHAIN as string | undefined;
  return raw?.trim() || "voi:mainnet";
}

export function gatewayAuthorizationHeader(): Record<string, string> {
  const key = import.meta.env.VITE_PAID_WORKFLOW_GATEWAY_API_KEY as string | undefined;
  if (!key?.trim()) return {};
  return { Authorization: `Bearer ${key.trim()}` };
}

/**
 * `@x402/evm` `toClientEvmSigner` expects `signer.address`, but viem `WalletClient` only exposes
 * the payer on `account` — so passing the client alone yields `address: undefined` and viem
 * throws `Address "undefined" is invalid` during EIP-3009 / Permit2 signing.
 */
function evmSignerFromWalletClient(
  walletClient: WalletClient,
  payerAddress: `0x${string}`
): ClientEvmSigner {
  if (!isAddress(payerAddress)) {
    throw new Error("Invalid paymentAddress for x402 EVM signer");
  }
  const address = getAddress(payerAddress);
  const account = walletClient.account ?? ({ address, type: "json-rpc" } as const);

  return toClientEvmSigner({
    address,
    signTypedData: (msg) =>
      walletClient.signTypedData({
        ...(msg as object),
        account,
      } as Parameters<WalletClient["signTypedData"]>[0]),
    readContract: walletClient.readContract
      ? (args) =>
          walletClient.readContract({
            ...(args as object),
            account,
          } as Parameters<WalletClient["readContract"]>[0])
      : undefined,
    getTransactionCount: walletClient.getTransactionCount
      ? (args) => {
          const a = args as { address?: `0x${string}` };
          return walletClient.getTransactionCount({
            ...(args as object),
            address: a.address ?? address,
          } as Parameters<WalletClient["getTransactionCount"]>[0]);
        }
      : undefined,
    signTransaction: walletClient.signTransaction
      ? (args) =>
          walletClient.signTransaction({
            ...(args as object),
            account,
          } as Parameters<WalletClient["signTransaction"]>[0])
      : undefined,
    estimateFeesPerGas: walletClient.estimateFeesPerGas
      ? walletClient.estimateFeesPerGas.bind(walletClient)
      : undefined,
  } as Parameters<typeof toClientEvmSigner>[0]);
}

/** Parsed execute body plus optional Base tx hash from x402 settle headers (`PAYMENT-RESPONSE`). */
export type ClaimlayerExecuteResponse = {
  body: unknown;
  x402PaymentTransaction?: string;
};

function extractX402PaymentTransaction(res: Response, http: x402HTTPClient): string | undefined {
  try {
    const settled = http.getPaymentSettleResponse((name) => res.headers.get(name));
    const tx = typeof settled.transaction === "string" ? settled.transaction.trim() : "";
    if (tx && /^0x[a-fA-F0-9]{8,}/i.test(tx)) return tx;
    return undefined;
  } catch {
    return undefined;
  }
}

async function readExecuteOkResponse(
  res: Response,
  http: x402HTTPClient
): Promise<ClaimlayerExecuteResponse> {
  const x402PaymentTransaction = extractX402PaymentTransaction(res, http);
  return { body: await res.json(), x402PaymentTransaction };
}

/**
 * POST `claimlayer-paid-claimall/execute` with JSON body. On 400 `PAYMENT_REQUIRED` or HTTP 402,
 * builds an x402 payment header (Base `eip155:8453` exact scheme) and retries once.
 */
export async function executeClaimlayerPaidClaimAll(args: {
  gatewayOrigin: string;
  body: ClaimlayerExecuteBody;
  walletClient: WalletClient;
}): Promise<ClaimlayerExecuteResponse> {
  const url = `${args.gatewayOrigin}/workflows/${CLAIMLAYER_WORKFLOW_ID}/execute`;
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...gatewayAuthorizationHeader(),
  };

  const evmSigner = evmSignerFromWalletClient(args.walletClient, args.body.paymentAddress);
  const x402 = new x402Client().register("eip155:8453", new ExactEvmScheme(evmSigner));
  const http = new x402HTTPClient(x402);

  const post = (headers: Record<string, string>) =>
    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(args.body),
    });

  let res = await post(baseHeaders);
  if (res.ok) {
    return readExecuteOkResponse(res, http);
  }

  const status = res.status;
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || `HTTP ${status}`);
  }

  if (!isGatewayPaymentRequiredBody(status, json)) {
    throw new Error(formatGatewayErrorMessage(status, json, text));
  }

  const paymentRequired = json as PaymentRequired;
  const paymentPayload = await x402.createPaymentPayload(paymentRequired);
  const payHeaders = http.encodePaymentSignatureHeader(paymentPayload);
  const merged: Record<string, string> = { ...baseHeaders };
  for (const [k, v] of Object.entries(payHeaders)) {
    merged[k] = v;
  }

  res = await post(merged);
  if (!res.ok) {
    const errText = await res.text();
    let errJson: unknown;
    try {
      errJson = errText ? JSON.parse(errText) : null;
    } catch {
      errJson = null;
    }
    throw new Error(formatGatewayErrorMessage(res.status, errJson, errText));
  }
  return readExecuteOkResponse(res, http);
}

/** Best-effort tx hash from gateway execute JSON (shapes vary by deploy). */
export function extractWorkflowTxHash(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const o = result as Record<string, unknown>;
  for (const key of ["txHash", "transactionHash", "hash", "txid", "transactionId"] as const) {
    const v = o[key];
    if (typeof v === "string" && /^0x[a-fA-F0-9]{8,}/i.test(v)) return v;
  }
  const nested = o.settlement ?? o.data ?? o.result ?? o.body;
  if (nested && typeof nested === "object") return extractWorkflowTxHash(nested);
  return undefined;
}
