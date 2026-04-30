/**
 * Global Configuration for DorkFi Protocol
 *
 * This file contains network-specific configurations, contract addresses,
 * and other global settings used throughout the application.
 */

import {
  FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY,
  FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS,
  type FolksFinancePoolParams,
} from "@/constants/folksFinance";

export type { FolksFinancePoolParams } from "@/constants/folksFinance";

export type NetworkId =
  | "voi-mainnet"
  | "algorand-mainnet"
  | "algorand-testnet"
  | "base-mainnet"
  | "base-testnet"
  | "ethereum-mainnet"
  | "ethereum-testnet"
  | "localnet";

export type NetworkType = "avm" | "evm";

export interface PowerMultiplier {
  id: string;
  label: string;
  contractId: number;
  bonus: number; // Bonus multiplier as a decimal (e.g., 0.10 for 10%)
}

export interface GovernanceConfig {
  appId: number;
  storageAppId: number;
  powerSources?: number[]; // Array of appIds used as sources of voting power
  powerMultipliers?: PowerMultiplier[]; // Array of NFT contracts that provide voting power bonuses
}

export interface ContractConfig {
  lendingPools: string[];
  priceOracle?: string;
  liquidationEngine?: string;
  governance?: string | GovernanceConfig;
  treasury?: string;
  marketController?: string;
  sToken?: string;
  beacon?: string;
  appStorageId?: string;
  // Add more contracts as needed
}

export type TokenStandard =
  | "network"
  | "asa"
  | "arc200"
  | "arc200-exchange"
  /** Native-coin wallet balance (like `network`), but deposits use ASA-style f-asset + ARC200 nt200 (for adapter flows). */
  | "network-asa"
  /**
   * Like `network-asa` (Folks + f-asset nt200), but the wallet-spendable collateral is the row ASA
   * (`assetId`), not the network native coin (`assetId` `"0"` / network token).
   */
  | "asa-asa";

/** `network-asa` or `asa-asa`: Folks-wrapped nt200 markets (shared deposit/repay adapter rules). */
export function tokenStandardIsFolksAsaBridge(standard: TokenStandard): boolean {
  return standard === "network-asa" || standard === "asa-asa";
}

/** ARC200 `balanceOf` on the nt200 underlying (used in lending deposit sizing). */
export function tokenStandardUsesNt200Arc200Balance(
  standard: TokenStandard
): boolean {
  return (
    standard === "network" ||
    standard === "asa" ||
    standard === "network-asa" ||
    standard === "asa-asa" ||
    standard === "arc200-exchange"
  );
}

/** Lending deposit/withdraw paths that use ASA fields (`aamt` / `xaid`) on nt200. */
export function tokenStandardUsesAsaStyleNt200Txns(
  standard: TokenStandard
): boolean {
  return standard === "asa" || standard === "network-asa" || standard === "asa-asa";
}

/** Wallet UI: native L1 balance (e.g. ALGO) like `network`, not ASA holding. */
export function tokenStandardUsesNativeWalletBalance(
  standard: TokenStandard
): boolean {
  return standard === "network" || standard === "network-asa";
}

export interface TokenConfig {
  assetId?: string;
  contractId?: string; // Contract address or application ID for smart contract tokens
  poolId?: string; // Lending pool ID for this token
  nTokenId?: string; // nToken ID for deposits in lending protocol
  decimals: number;
  name: string;
  symbol: string;
  logoPath: string;
  tokenStandard: TokenStandard; // network | asa | arc200 | arc200-exchange | network-asa | asa-asa
  // Market override configuration
  marketOverride?: {
    displayName: string;
    displaySymbol: string;
    underlyingAssetId?: string; // The actual asset ID if different from display
    underlyingContractId?: string; // The actual contract ID if different from display
    isSmartContract: boolean; // Whether this is a smart contract-based asset
  };
  oldPoolId?: string;
  oldContractId?: string;
  oldNTokenId?: string;
  isStoken?: boolean;
  migration?: {
    poolId: string;
    contractId: string;
    nTokenId: string;
  };
  /** When true, this token row participates in a DorkFi bonus rewards program (CTAs, badges, links). */
  hasRewards?: boolean;
  /**
   * Optional deployment instance id for this row (`https://{id}.{provider host}`). Used when
   * {@link rewardsPublicBaseUrl} is unset; wins over the global registry for the same
   * `(networkId, poolId, contractId)`.
   */
  rewardsInstanceId?: string;
  /**
   * Optional full HTTPS origin for the rewards app (highest-priority override). When set, ignores
   * {@link rewardsInstanceId}, registry, and `VITE_REWARDS_PROVIDER_HOST` for the origin host.
   */
  rewardsPublicBaseUrl?: string;
  /** ISO 8601 timestamp when this token row was added to config (optional metadata). */
  dataAddedAt?: string;
  /**
   * Optional intrinsic supply APY in percentage points (e.g. 4.55 for 4.55%) from the asset
   * itself (e.g. governance staking), added to on-chain supply APY for display.
   */
  intrinsicApyPercent?: number;
  /**
   * When set on Algorand mainnet, {@link resolveIntrinsicSupplyApyPercent} may prefer a live rate
   * over {@link intrinsicApyPercent} when the corresponding fetch succeeds.
   */
  intrinsicApyLiveSource?:
  | "tinyman_liquid_staking"
  | "xalgo_governance_lambda"
  | "folks_mainnet_algo_pool_deposit"
  | "folks_mainnet_usdc_pool_deposit"
  | "folks_mainnet_fiusdc_ecosystem_pool_deposit";
  /**
   * Optional intrinsic borrow APY in percentage points (e.g. 1.5 for 1.5%), added to displayed
   * borrow APY for this listing (e.g. wrapped-asset borrow uplift).
   */
  intrinsicBorrowApyPercent?: number;
  /**
   * When set on Algorand mainnet, {@link resolveIntrinsicBorrowApyPercent} may prefer a live rate
   * over {@link intrinsicBorrowApyPercent} when the corresponding fetch succeeds.
   */
  intrinsicBorrowApyLiveSource?:
  | "tinyman_liquid_staking"
  | "xalgo_governance_lambda"
  | "folks_mainnet_algo_pool_deposit"
  | "folks_mainnet_usdc_pool_borrow"
  | "folks_mainnet_fiusdc_ecosystem_pool_borrow";
  /**
   * Optional wrapped-asset / bridge adapters (e.g. Folks mint/redeem), in order.
   * Use {@link TokenAdapterConfig.phases} to split deposit vs withdraw legs, and `id` + `label`
   * when the UI should let the user pick among multiple withdraw (or deposit) routes.
   * Lending markets under a map key like `ALGO: [...]` are canonical for `network-asa`; the
   * standalone `tokens.fALGO` row mirrors adapter metadata for lookups by `getTokenConfig("fALGO")`.
   */
  adapters?: TokenAdapterConfig[];
  /** @deprecated Use {@link adapters} or set both — merged after `adapters` in {@link getTokenAdapterList}. */
  adapter?: TokenAdapterConfig;
  /**
   * When true on Algorand mainnet Folks-backed markets, the deposit modal requires a standalone
   * ASA opt-in to this row’s Folks f-asset before building the main supply transaction group.
   * Workaround for first-time deposits where bundling opt-in with Folks mint + nt200 would exceed
   * the maximum atomic group size (e.g. d-pool USDC / fUSDC).
   */
  requireStandaloneFAssetOptInBeforeDeposit?: boolean;
  /**
   * When true on Algorand mainnet, the deposit modal requires a standalone opt-in to this row’s
   * {@link assetId} (the market / wrapper ASA, e.g. xALGO) before supply. Skipped when the user
   * selects a route that does not spend that ASA from the wallet (e.g. xALGO consensus ALGO deposit).
   */
  requireStandaloneMarketAsaOptInBeforeDeposit?: boolean;
  /**
   * Optional bottom-right badge on the market token icon: same symbol→URL map as
   * `getTokenImagePath` in `tokenImageUtils` (e.g. `"FOLKS"`). Shown in markets table / cards next
   * to the pool letter badge (top-right).
   */
  iconBadgeFromSymbol?: string;
}

/** Which user flows an adapter participates in (omit = both, for backward compatibility). */
export type AdapterPhase = "deposit" | "withdraw" | "borrow" | "repay";

export type TokenAdapterConfig = {
  /**
   * Stable id for UI selection and `deposit` / `withdraw` options (see {@link tokenAdapterStableId}).
   * Required when multiple adapters share the same `type` + pool for a phase.
   */
  id?: string;
  /** Human label for deposit/withdraw route pickers. */
  label?: string;
  name: string;
  type: "folks";
  folksParams: FolksFinancePoolParams;
  /**
   * For deposit routes: what the user spends from the wallet for this adapter.
   * `underlying` = native / primary ASA (e.g. ALGO in for Folks mint). `market_token` = f-ASA already held.
   * Omit = underlying for `network-asa` + Folks (legacy behavior).
   */
  depositWalletBasis?: "underlying" | "market_token";
  /**
   * For withdraw routes: what the user receives after nt200 pool withdraw (+ token app).
   * `underlying` = Folks redeem f-ASA to native (e.g. ALGO). `market_token` = keep f-ASA in the wallet.
   * Omit = underlying for Folks `network-asa` (legacy).
   */
  withdrawReceiveBasis?: "underlying" | "market_token";
  /**
   * For borrow routes (Folks `network-asa`): what the user receives after nt200 releases borrowed f-ASA.
   * `market_token` = keep f-ASA (e.g. fALGO). `underlying` = append Folks pool redeem to native ALGO.
   */
  borrowReceiveBasis?: "underlying" | "market_token";
  /**
   * For repay routes (Folks `network-asa`): what the user spends from the wallet before nt200 deposit + repay.
   * `market_token` = f-ASA already held. `underlying` = native / primary ASA → Folks mint f-asset, then repay.
   */
  repayWalletBasis?: "underlying" | "market_token";
  /**
   * When set, this adapter runs only for these flows.
   * When omitted, applies to deposit and withdraw; borrow requires `phases` containing `"borrow"`;
   * repay requires `phases` containing `"repay"`.
   */
  phases?: AdapterPhase[];
};

/**
 * Shared Folks ALGO mainnet adapter (single deposit+withdraw slot). Prefer the split adapters
 * below when a market needs separate deposit routes (f-ASA vs ALGO).
 */
export const FOLKS_MAINNET_ALGO_TOKEN_ADAPTER = {
  id: "folks-mainnet-algo",
  name: "ALGO",
  type: "folks" as const,
  label: "Folks (ALGO pool)",
  depositWalletBasis: "underlying" as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.ALGO,
} satisfies TokenAdapterConfig;

/** Default fALGO deposit: spend f-ASA from the wallet (no Folks mint). */
export const FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET = {
  id: "folks-mainnet-algo-deposit-falgo",
  name: "fALGO",
  type: "folks" as const,
  label: "fALGO",
  depositWalletBasis: "market_token" as const,
  phases: ["deposit"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.ALGO,
} satisfies TokenAdapterConfig;

/** Deposit native ALGO → Folks mint f-asset, then nt200 supply. */
export const FOLKS_MAINNET_ALGO_DEPOSIT_UNDERLYING = {
  id: "folks-mainnet-algo-deposit-algo",
  name: "ALGO",
  type: "folks" as const,
  label: "ALGO",
  depositWalletBasis: "underlying" as const,
  phases: ["deposit"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.ALGO,
} satisfies TokenAdapterConfig;

/**
 * When true, mainnet fALGO “Deposit ALGO” is split: sign Folks mint only, then sign supply using
 * the f-ALGO wallet route (avoids one-group estimate mismatch). Set `VITE_FOLKS_ALGO_DEPOSIT_TWO_STEP=1`.
 */
export function isFolksAlgoDepositTwoStepEnabled(): boolean {
  return (
    import.meta.env.VITE_FOLKS_ALGO_DEPOSIT_TWO_STEP === "true" ||
    import.meta.env.VITE_FOLKS_ALGO_DEPOSIT_TWO_STEP === "1"
  );
}

/**
 * When true, mainnet “Withdraw ALGO” (Folks underlying route) is split: sign lending withdraw to
 * f-ALGO only, then sign Folks redeem (`VITE_FOLKS_ALGO_WITHDRAW_TWO_STEP=1`).
 */
export function isFolksAlgoWithdrawTwoStepEnabled(): boolean {
  return (
    import.meta.env.VITE_FOLKS_ALGO_WITHDRAW_TWO_STEP === "true" ||
    import.meta.env.VITE_FOLKS_ALGO_WITHDRAW_TWO_STEP === "1"
  );
}

/** Folks: nt200 withdraw → token, then redeem f-ASA to native ALGO. */
export const FOLKS_MAINNET_ALGO_WITHDRAW = {
  id: "folks-mainnet-algo-withdraw",
  name: "ALGO",
  type: "folks" as const,
  label: "ALGO",
  withdrawReceiveBasis: "underlying" as const,
  phases: ["withdraw"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.ALGO,
} satisfies TokenAdapterConfig;

/** Folks: nt200 withdraw → user receives f-ASA (no pool redeem to native). */
export const FOLKS_MAINNET_ALGO_WITHDRAW_FASSET_WALLET = {
  id: "folks-mainnet-algo-withdraw-falgo",
  name: "fALGO",
  type: "folks" as const,
  label: "fALGO",
  withdrawReceiveBasis: "market_token" as const,
  phases: ["withdraw"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.ALGO,
} satisfies TokenAdapterConfig;

/** Folks: after borrow + nt200 withdraw, user keeps f-ASA (no Folks redeem in group). */
export const FOLKS_MAINNET_ALGO_BORROW_FASSET_WALLET = {
  id: "folks-mainnet-algo-borrow-falgo",
  name: "fALGO",
  type: "folks" as const,
  label: "fALGO",
  borrowReceiveBasis: "market_token" as const,
  phases: ["borrow"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.ALGO,
} satisfies TokenAdapterConfig;

/** Folks: after borrow + nt200 withdraw, redeem f-ASA → native ALGO in the same atomic group. */
export const FOLKS_MAINNET_ALGO_BORROW_UNDERLYING = {
  id: "folks-mainnet-algo-borrow-algo",
  name: "ALGO",
  type: "folks" as const,
  label: "ALGO",
  borrowReceiveBasis: "underlying" as const,
  phases: ["borrow"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.ALGO,
} satisfies TokenAdapterConfig;

/** Repay using f-ASA from the wallet (no Folks mint preamble). */
export const FOLKS_MAINNET_ALGO_REPAY_FASSET_WALLET = {
  id: "folks-mainnet-algo-repay-falgo",
  name: "fALGO",
  type: "folks" as const,
  label: "fALGO",
  repayWalletBasis: "market_token" as const,
  phases: ["repay"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.ALGO,
} satisfies TokenAdapterConfig;

/** Repay with native ALGO → Folks mint f-asset, then nt200 deposit + repay. */
export const FOLKS_MAINNET_ALGO_REPAY_UNDERLYING = {
  id: "folks-mainnet-algo-repay-algo",
  name: "ALGO",
  type: "folks" as const,
  label: "ALGO",
  repayWalletBasis: "underlying" as const,
  phases: ["repay"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.ALGO,
} satisfies TokenAdapterConfig;

/** Folks USDC pool — same phase split as {@link FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET} / underlying, for `asa-asa` rows whose `assetId` is USDC. */
export const FOLKS_MAINNET_USDC_DEPOSIT_FUSDC_WALLET = {
  id: "folks-mainnet-usdc-deposit-fusdc",
  name: "fUSDC",
  type: "folks" as const,
  label: "fUSDC",
  depositWalletBasis: "market_token" as const,
  phases: ["deposit"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.USDC,
} satisfies TokenAdapterConfig;

/** Deposit USDC → Folks mint fUSDC, then nt200 supply. */
export const FOLKS_MAINNET_USDC_DEPOSIT_UNDERLYING = {
  id: "folks-mainnet-usdc-deposit-usdc",
  name: "USDC",
  type: "folks" as const,
  label: "USDC",
  depositWalletBasis: "underlying" as const,
  phases: ["deposit"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.USDC,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_USDC_WITHDRAW = {
  id: "folks-mainnet-usdc-withdraw",
  name: "USDC",
  type: "folks" as const,
  label: "USDC",
  withdrawReceiveBasis: "underlying" as const,
  phases: ["withdraw"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.USDC,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_USDC_WITHDRAW_FASSET_WALLET = {
  id: "folks-mainnet-usdc-withdraw-fusdc",
  name: "fUSDC",
  type: "folks" as const,
  label: "fUSDC",
  withdrawReceiveBasis: "market_token" as const,
  phases: ["withdraw"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.USDC,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_USDC_BORROW_FUSDC_WALLET = {
  id: "folks-mainnet-usdc-borrow-fusdc",
  name: "fUSDC",
  type: "folks" as const,
  label: "fUSDC",
  borrowReceiveBasis: "market_token" as const,
  phases: ["borrow"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.USDC,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_USDC_BORROW_UNDERLYING = {
  id: "folks-mainnet-usdc-borrow-usdc",
  name: "USDC",
  type: "folks" as const,
  label: "USDC",
  borrowReceiveBasis: "underlying" as const,
  phases: ["borrow"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.USDC,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_USDC_REPAY_FUSDC_WALLET = {
  id: "folks-mainnet-usdc-repay-fusdc",
  name: "fUSDC",
  type: "folks" as const,
  label: "fUSDC",
  repayWalletBasis: "market_token" as const,
  phases: ["repay"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.USDC,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_USDC_REPAY_UNDERLYING = {
  id: "folks-mainnet-usdc-repay-usdc",
  name: "USDC",
  type: "folks" as const,
  label: "USDC",
  repayWalletBasis: "underlying" as const,
  phases: ["repay"] as const,
  folksParams: FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.USDC,
} satisfies TokenAdapterConfig;

/** Folks Algorand Ecosystem USDC (fiUSDC) — same phase split as {@link FOLKS_MAINNET_USDC_DEPOSIT_FUSDC_WALLET}. */
export const FOLKS_MAINNET_FIUSDC_DEPOSIT_FIUSDC_WALLET = {
  id: "folks-mainnet-fiusdc-deposit-fiusdc",
  name: "fiUSDC",
  type: "folks" as const,
  label: "fiUSDC",
  depositWalletBasis: "market_token" as const,
  phases: ["deposit"] as const,
  folksParams: FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_FIUSDC_DEPOSIT_UNDERLYING = {
  id: "folks-mainnet-fiusdc-deposit-usdc",
  name: "USDC",
  type: "folks" as const,
  label: "USDC",
  depositWalletBasis: "underlying" as const,
  phases: ["deposit"] as const,
  folksParams: FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_FIUSDC_WITHDRAW = {
  id: "folks-mainnet-fiusdc-withdraw-usdc",
  name: "USDC",
  type: "folks" as const,
  label: "USDC",
  withdrawReceiveBasis: "underlying" as const,
  phases: ["withdraw"] as const,
  folksParams: FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_FIUSDC_WITHDRAW_FASSET_WALLET = {
  id: "folks-mainnet-fiusdc-withdraw-fiusdc",
  name: "fiUSDC",
  type: "folks" as const,
  label: "fiUSDC",
  withdrawReceiveBasis: "market_token" as const,
  phases: ["withdraw"] as const,
  folksParams: FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_FIUSDC_BORROW_FIUSDC_WALLET = {
  id: "folks-mainnet-fiusdc-borrow-fiusdc",
  name: "fiUSDC",
  type: "folks" as const,
  label: "fiUSDC",
  borrowReceiveBasis: "market_token" as const,
  phases: ["borrow"] as const,
  folksParams: FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_FIUSDC_BORROW_UNDERLYING = {
  id: "folks-mainnet-fiusdc-borrow-usdc",
  name: "USDC",
  type: "folks" as const,
  label: "USDC",
  borrowReceiveBasis: "underlying" as const,
  phases: ["borrow"] as const,
  folksParams: FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_FIUSDC_REPAY_FIUSDC_WALLET = {
  id: "folks-mainnet-fiusdc-repay-fiusdc",
  name: "fiUSDC",
  type: "folks" as const,
  label: "fiUSDC",
  repayWalletBasis: "market_token" as const,
  phases: ["repay"] as const,
  folksParams: FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS,
} satisfies TokenAdapterConfig;

export const FOLKS_MAINNET_FIUSDC_REPAY_UNDERLYING = {
  id: "folks-mainnet-fiusdc-repay-usdc",
  name: "USDC",
  type: "folks" as const,
  label: "USDC",
  repayWalletBasis: "underlying" as const,
  phases: ["repay"] as const,
  folksParams: FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS,
} satisfies TokenAdapterConfig;

export type FolksTokenAdapterConfig = Extract<
  TokenAdapterConfig,
  { type: "folks" }
>;

function adapterAppliesToPhase(
  adapter: TokenAdapterConfig,
  phase: AdapterPhase
): boolean {
  const p = adapter.phases;
  // Borrow / repay are opt-in only so legacy adapters without `phases` stay deposit+withdraw.
  if (phase === "borrow") {
    return p != null && p.includes("borrow");
  }
  if (phase === "repay") {
    return p != null && p.includes("repay");
  }
  if (p == null || p.length === 0) {
    return true;
  }
  return p.includes(phase);
}

/**
 * Ordered merge of `adapters` then legacy singular `adapter` (when present).
 */
export function getTokenAdapterList(
  token: Pick<TokenConfig, "adapter" | "adapters">
): TokenAdapterConfig[] {
  const primary = token.adapters ?? [];
  const legacy = token.adapter ? [token.adapter] : [];
  return [...primary, ...legacy];
}

export function getTokenAdaptersForPhase(
  token: Pick<TokenConfig, "adapter" | "adapters">,
  phase: AdapterPhase
): TokenAdapterConfig[] {
  return getTokenAdapterList(token).filter((a) => adapterAppliesToPhase(a, phase));
}

/** First Folks adapter that applies to `phase`. */
export function getFolksAdapterForPhase(
  token: Pick<TokenConfig, "adapter" | "adapters">,
  phase: AdapterPhase
): FolksTokenAdapterConfig | undefined {
  return getFolksAdaptersForPhase(token, phase)[0];
}

/** All Folks adapters for `phase` (e.g. multiple withdraw exit routes). */
export function getFolksAdaptersForPhase(
  token: Pick<TokenConfig, "adapter" | "adapters">,
  phase: AdapterPhase
): FolksTokenAdapterConfig[] {
  return getTokenAdaptersForPhase(token, phase).filter(
    (a): a is FolksTokenAdapterConfig => a.type === "folks"
  );
}

/** Stable id for passing adapter choice through modals → `lendingService`. */
export function tokenAdapterStableId(adapter: TokenAdapterConfig): string {
  const raw = adapter.id != null ? String(adapter.id).trim() : "";
  if (raw !== "") return raw;
  if (adapter.type === "folks") {
    return `folks:${adapter.folksParams.pool}`;
  }
  return `${adapter.type}:${adapter.name}`;
}

/** Resolve which Folks deposit adapter to run (matches `depositAdapterId` or first). */
export function resolveDepositFolksAdapter(
  token: Pick<TokenConfig, "adapter" | "adapters">,
  depositAdapterId?: string | null
): FolksTokenAdapterConfig | undefined {
  const list = getFolksAdaptersForPhase(token, "deposit");
  if (list.length === 0) return undefined;
  const want =
    depositAdapterId != null && String(depositAdapterId).trim() !== ""
      ? String(depositAdapterId).trim()
      : null;
  if (want != null) {
    const hit = list.find((a) => tokenAdapterStableId(a) === want);
    if (hit) return hit;
    console.warn(
      "[resolveDepositFolksAdapter] depositAdapterId not found; using first deposit-phase Folks adapter.",
      { depositAdapterId: want, available: list.map(tokenAdapterStableId) }
    );
  }
  return list[0];
}

/** Resolve which Folks withdraw adapter to run (matches `withdrawAdapterId` or first). */
export function resolveWithdrawFolksAdapter(
  token: Pick<TokenConfig, "adapter" | "adapters">,
  withdrawAdapterId?: string | null
): FolksTokenAdapterConfig | undefined {
  const list = getFolksAdaptersForPhase(token, "withdraw");
  if (list.length === 0) return undefined;
  const want =
    withdrawAdapterId != null && String(withdrawAdapterId).trim() !== ""
      ? String(withdrawAdapterId).trim()
      : null;
  if (want != null) {
    const hit = list.find((a) => tokenAdapterStableId(a) === want);
    if (hit) return hit;
    console.warn(
      "[resolveWithdrawFolksAdapter] withdrawAdapterId not found; using first withdraw-phase Folks adapter.",
      { withdrawAdapterId: want, available: list.map(tokenAdapterStableId) }
    );
  }
  return list[0];
}

/** Resolve which Folks borrow-phase adapter to run (matches `borrowAdapterId` or first). */
export function resolveBorrowFolksAdapter(
  token: Pick<TokenConfig, "adapter" | "adapters">,
  borrowAdapterId?: string | null
): FolksTokenAdapterConfig | undefined {
  const list = getFolksAdaptersForPhase(token, "borrow");
  if (list.length === 0) return undefined;
  const want =
    borrowAdapterId != null && String(borrowAdapterId).trim() !== ""
      ? String(borrowAdapterId).trim()
      : null;
  if (want != null) {
    const hit = list.find((a) => tokenAdapterStableId(a) === want);
    if (hit) return hit;
    console.warn(
      "[resolveBorrowFolksAdapter] borrowAdapterId not found; using first borrow-phase Folks adapter.",
      { borrowAdapterId: want, available: list.map(tokenAdapterStableId) }
    );
  }
  return list[0];
}

/** Resolve which Folks repay-phase adapter to run (matches `repayAdapterId` or first). */
export function resolveRepayFolksAdapter(
  token: Pick<TokenConfig, "adapter" | "adapters">,
  repayAdapterId?: string | null
): FolksTokenAdapterConfig | undefined {
  const list = getFolksAdaptersForPhase(token, "repay");
  if (list.length === 0) return undefined;
  const want =
    repayAdapterId != null && String(repayAdapterId).trim() !== ""
      ? String(repayAdapterId).trim()
      : null;
  if (want != null) {
    const hit = list.find((a) => tokenAdapterStableId(a) === want);
    if (hit) return hit;
    console.warn(
      "[resolveRepayFolksAdapter] repayAdapterId not found; using first repay-phase Folks adapter.",
      { repayAdapterId: want, available: list.map(tokenAdapterStableId) }
    );
  }
  return list[0];
}

/** Any Folks adapter on the row (ignores `phases`), for pricing / mint-ratio reads. */
export function getAnyFolksAdapter(
  token: Pick<TokenConfig, "adapter" | "adapters">
): FolksTokenAdapterConfig | undefined {
  return getTokenAdapterList(token).find(
    (a): a is FolksTokenAdapterConfig => a.type === "folks"
  );
}

export function tokenConfigHasAdapters(
  token: Pick<TokenConfig, "adapter" | "adapters"> | null | undefined
): boolean {
  if (token == null) return false;
  return getTokenAdapterList(token).length > 0;
}

/** True if any configured adapter is not Folks (e.g. future bridge types). */
export function tokenConfigHasNonFolksAdapter(
  token: Pick<TokenConfig, "adapter" | "adapters"> | null | undefined
): boolean {
  if (token == null) return false;
  return getTokenAdapterList(token).some((a) => a.type !== "folks");
}

/** Markets with `dataAddedAt` within this window are treated as "new" on the Markets page. */
export const NEW_MARKET_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export function isNewMarketByDataAddedAt(dataAddedAt?: string): boolean {
  if (!dataAddedAt) return false;
  const t = Date.parse(dataAddedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < NEW_MARKET_WINDOW_MS;
}

export interface PreFiParameters {
  collateral_factor: number;
  liquidation_threshold: number;
  reserve_factor: number;
  borrow_rate_base: number;
  slope: number;
  liquidation_bonus: number;
  close_factor: number;
  max_borrow_caps: {
    stablecoins: string;
    majors: string;
    volatile: string;
  };
}

export interface BaseNetworkConfig {
  networkId: NetworkId;
  walletNetworkId: string;
  name: string;
  networkType: NetworkType;
  rpcUrl: string;
  rpcPort?: number;
  rpcToken?: string;
  indexerUrl: string;
  explorerUrl: string;
  faucetUrl?: string;
}

export interface NetworkConfig extends BaseNetworkConfig {
  rpcPublicUrl?: string;
  contracts: ContractConfig;
  tokens: {
    [symbol: string]: TokenConfig | TokenConfig[];
  };
  preFiParameters?: PreFiParameters;
  gasStation?: string[];
}

export interface GlobalConfig {
  networks: {
    [K in NetworkId]: NetworkConfig;
  };
  defaultNetwork: NetworkId;
  enabledNetworks: NetworkId[];
  version: string;
  features: {
    enablePreFi: boolean;
    enableLiquidations: boolean;
    enableSwap: boolean;
    enableGovernance: boolean;
    enableMigration: boolean;
    enableGasStation: boolean;
    enableNFTBoost: boolean;
    enableLiquidatablePositions: boolean;
  };
}

/**
 * VOI Mainnet Configuration
 */
const baseVoiMainnetConfig: BaseNetworkConfig = {
  networkId: "voi-mainnet",
  walletNetworkId: "voimain",
  name: "VOI Mainnet",
  networkType: "avm",
  rpcUrl: "https://mainnet-api.voi.dork.fi",
  rpcPort: 443,
  rpcToken: "",
  indexerUrl: "https://mainnet-idx.voi.nodely.dev",
  explorerUrl: "https://block.voi.network",
  faucetUrl: "https://faucet.voirewards.com/",
};
// prefi
const prefiLendingPools = ["41760711", "44866061"];
const prefiTokens = {
  VOI: {
    assetId: "0",
    poolId: "41760711",
    contractId: "41877720",
    nTokenId: "42125195",
    decimals: 6,
    name: "VOI",
    symbol: "VOI",
    logoPath: "/lovable-uploads/VOI.png",
    tokenStandard: "network",
    marketOverride: {
      displayName: "Voi",
      displaySymbol: "Voi",
      isSmartContract: true,
    },
  },
  aUSDC: {
    assetId: "302190",
    poolId: "41760711",
    contractId: "395614",
    nTokenId: "42577758",
    decimals: 6,
    name: "Aramid USDC",
    symbol: "aUSDC",
    logoPath: "/lovable-uploads/aUSDC.png",
    tokenStandard: "asa",
  },
  UNIT: {
    contractId: "420069",
    poolId: "41760711",
    nTokenId: "42638644",
    decimals: 8,
    name: "UNIT",
    symbol: "UNIT",
    logoPath: "/lovable-uploads/UNIT.png",
    tokenStandard: "arc200",
  },
  aALGO: {
    assetId: "302189",
    contractId: "413153",
    poolId: "41760711",
    nTokenId: "42674504",
    decimals: 6,
    name: "Aramid Algorand",
    symbol: "aALGO",
    logoPath: "/lovable-uploads/aALGO.png",
    tokenStandard: "asa",
  },
  aETH: {
    assetId: "302193",
    contractId: "40153308",
    poolId: "41760711",
    nTokenId: "42682188",
    decimals: 6,
    name: "Aramid ETH",
    symbol: "aETH",
    logoPath: "/lovable-uploads/aETH.png",
    tokenStandard: "asa",
  },
  aBTC: {
    assetId: "40152643",
    contractId: "40153368",
    poolId: "41760711",
    nTokenId: "42701185",
    decimals: 8,
    name: "Wrapped BTC",
    symbol: "aBTC",
    logoPath: "/lovable-uploads/WrappedBTC.png",
    tokenStandard: "asa",
  },
  acbBTC: {
    assetId: "40152648",
    contractId: "40153415",
    poolId: "41760711",
    nTokenId: "42706178",
    decimals: 8,
    name: "Coinbase BTC",
    symbol: "acbBTC",
    logoPath: "/lovable-uploads/cbBTC.png",
    tokenStandard: "asa",
  },
  POW: {
    assetId: "40152679",
    contractId: "40153155",
    poolId: "41760711",
    nTokenId: "42702842",
    decimals: 6,
    name: "POW",
    symbol: "POW",
    logoPath: "/lovable-uploads/POW.png",
    tokenStandard: "asa",
  },
  FV: {
    assetId: "0",
    contractId: "770561",
    poolId: "44866061",
    nTokenId: "45052343",
    decimals: 6,
    name: "Fountain VOI",
    symbol: "FV",
    logoPath: "https://asset-verification.nautilus.sh/icons/770561.png",
    tokenStandard: "network",
  },
  NV: {
    assetId: "0",
    contractId: "8324600",
    poolId: "44866061",
    nTokenId: "45052477",
    decimals: 6,
    name: "Nautilus VOI",
    symbol: "NV",
    logoPath: "/lovable-uploads/NV.png",
    tokenStandard: "network",
  },
  EV: {
    assetId: "0",
    contractId: "828295",
    poolId: "44866061",
    nTokenId: "45447486",
    decimals: 6,
    name: "enVOI",
    symbol: "EV",
    logoPath: "/lovable-uploads/EV.png",
    tokenStandard: "network",
  },
  bVOI: {
    assetId: "0",
    contractId: "8471125",
    poolId: "44866061",
    nTokenId: "45052513",
    decimals: 6,
    name: "BUIDL VOI",
    symbol: "bVOI",
    logoPath: "/lovable-uploads/bVOI.png",
    tokenStandard: "network",
  },
  NODE: {
    contractId: "410811",
    poolId: "44866061",
    nTokenId: "44872392",
    decimals: 6,
    name: "NODE",
    symbol: "NODE",
    logoPath: "https://asset-verification.nautilus.sh/icons/410811.png",
    tokenStandard: "arc200",
  },
  BUIDL: {
    contractId: "419744",
    poolId: "44866061",
    nTokenId: "44872401",
    decimals: 8,
    name: "BUIDL",
    symbol: "BUIDL",
    logoPath: "https://asset-verification.nautilus.sh/icons/419744.png",
    tokenStandard: "arc200",
  },
  SHELLY: {
    contractId: "410111",
    poolId: "44866061",
    nTokenId: "44872410",
    decimals: 8,
    name: "SHELLY",
    symbol: "SHELLY",
    logoPath: "https://asset-verification.nautilus.sh/icons/410111.png",
    tokenStandard: "arc200",
  },
  AMMO: {
    contractId: "798968",
    poolId: "44866061",
    nTokenId: "44872488",
    decimals: 6,
    name: "AMMO",
    symbol: "AMMO",
    logoPath: "https://asset-verification.nautilus.sh/icons/798968.png",
    tokenStandard: "arc200",
  },
  GM: {
    contractId: "300279",
    poolId: "44866061",
    nTokenId: "44872696",
    decimals: 2,
    name: "GM",
    symbol: "GM",
    logoPath: "https://asset-verification.nautilus.sh/icons/300279.png",
    tokenStandard: "arc200",
  },
  CORN: {
    contractId: "412682",
    poolId: "44866061",
    nTokenId: "44872738",
    decimals: 6,
    name: "CORN",
    symbol: "CORN",
    logoPath: "https://asset-verification.nautilus.sh/icons/412682.png",
    tokenStandard: "arc200",
  },
  F: {
    contractId: "302222",
    poolId: "44866061",
    nTokenId: "44872864",
    decimals: 6,
    name: "F",
    symbol: "F",
    logoPath: "https://asset-verification.nautilus.sh/icons/302222.png",
    tokenStandard: "arc200",
  },
  IAT: {
    contractId: "420024",
    poolId: "44866061",
    nTokenId: "44872814",
    decimals: 6,
    name: "IAT",
    symbol: "IAT",
    logoPath: "https://asset-verification.nautilus.sh/icons/420024.png",
    tokenStandard: "arc200",
  },
};
// beta
const betaTokens: { [symbol: string]: TokenConfig } = {
  VOI: {
    contractId: "46504436",
    poolId: "46505156",
    nTokenId: "46505178",
    decimals: 6,
    name: "VOI",
    symbol: "VOI",
    logoPath: "/lovable-uploads/VOI.png",
    tokenStandard: "arc200",
  },
  ALGO: {
    contractId: "46524931",
    poolId: "46505156",
    nTokenId: "46524938",
    decimals: 6,
    name: "ALGO",
    symbol: "ALGO",
    logoPath: "/lovable-uploads/Algo.webp",
    tokenStandard: "arc200",
  },
  UNIT: {
    contractId: "46828654",
    poolId: "46505156",
    nTokenId: "46828659",
    decimals: 6,
    name: "UNIT",
    symbol: "UNIT",
    logoPath: "/lovable-uploads/UNIT.png",
    tokenStandard: "arc200",
  },
  USDC: {
    contractId: "46528289",
    poolId: "46505156",
    nTokenId: "46528328",
    decimals: 6,
    name: "USDC",
    symbol: "USDC",
    logoPath: "/lovable-uploads/USDC.webp",
    tokenStandard: "arc200",
  },
  aUSDC: {
    contractId: "46828606",
    poolId: "46505156",
    nTokenId: "46828612",
    decimals: 6,
    name: "aUSDC",
    symbol: "aUSDC",
    logoPath: "/lovable-uploads/aUSDC.png",
    tokenStandard: "arc200",
  },
  ETH: {
    contractId: "46528374",
    poolId: "46505156",
    nTokenId: "46528379",
    decimals: 6,
    name: "ETH",
    symbol: "ETH",
    logoPath: "/lovable-uploads/ETH.jpg",
    tokenStandard: "arc200",
  },
  BTC: {
    contractId: "46528407",
    poolId: "46505156",
    nTokenId: "46528426",
    decimals: 6,
    name: "BTC",
    symbol: "BTC",
    logoPath: "/lovable-uploads/WrappedBTC.png",
    tokenStandard: "arc200",
  },
  WAD: {
    contractId: "46820876",
    poolId: "46505156",
    nTokenId: "46822098",
    decimals: 6,
    name: "WAD",
    symbol: "WAD",
    logoPath: "/lovable-uploads/WAD_fixed.png",
    tokenStandard: "arc200",
    isStoken: true,
  },
};
const betaLendingPools = ["46505156"];
const betaContracts = {
  lendingPools: [...betaLendingPools],
  priceOracle: "46826662", // Gooch
  liquidationEngine: undefined,
  governance: undefined,
  treasury: undefined,
  marketController: "46565930",
  sToken: "46820876",
};
const betaPreFiParameters = {
  collateral_factor: 780, // 78% = 780 bp
  liquidation_threshold: 825, // 82.5% = 825 bp
  reserve_factor: 100, // 10% = 100 bp
  borrow_rate_base: 50, // 5% = 50 bp
  slope: 100, // 10% = 100 bp
  liquidation_bonus: 50, // 5% = 50 bp
  close_factor: 350, // 35% = 350 bps
  max_borrow_caps: {
    stablecoins: "100000",
    majors: "50000",
    volatile: "10000",
  },
};
const betaGasStation = [...Object.keys(betaTokens)];
const betaVoiMainnetConfig: NetworkConfig = {
  ...baseVoiMainnetConfig,
  contracts: { ...betaContracts },
  tokens: { ...betaTokens },
  gasStation: [...betaGasStation],
  preFiParameters: { ...betaPreFiParameters },
};
const prodAMarket = "47139778";
const prodBMarket = "47139781";
const prodTokens: { [symbol: string]: TokenConfig | TokenConfig[] } = {
  VOI: {
    assetId: "0",
    poolId: "47139778",
    contractId: "41877720",
    nTokenId: "47139789",
    migration: {
      poolId: "41760711",
      contractId: "41877720",
      nTokenId: "42125195",
    },
    decimals: 6,
    name: "VOI",
    symbol: "VOI",
    logoPath: "/lovable-uploads/VOI.png",
    tokenStandard: "network",
    marketOverride: {
      displayName: "Voi",
      displaySymbol: "Voi",
      isSmartContract: true,
    },
  },
  aUSDC: {
    assetId: "302190",
    poolId: "47139778",
    contractId: "395614",
    nTokenId: "47140315",
    migration: {
      poolId: "41760711",
      contractId: "395614",
      nTokenId: "42577758",
    },
    decimals: 6,
    name: "Aramid USDC",
    symbol: "aUSDC",
    logoPath: "/lovable-uploads/aUSDC.png",
    tokenStandard: "asa",
  },
  UNIT: {
    contractId: "420069",
    poolId: "47139778",
    nTokenId: "47148525",
    migration: {
      contractId: "420069",
      poolId: "41760711",
      nTokenId: "42638644",
    },
    decimals: 8,
    name: "UNIT",
    symbol: "UNIT",
    logoPath: "/lovable-uploads/UNIT.png",
    tokenStandard: "arc200",
  },
  aALGO: {
    assetId: "302189",
    contractId: "413153",
    poolId: "47139778",
    nTokenId: "47475308",
    migration: {
      contractId: "413153",
      poolId: "41760711",
      nTokenId: "42674504",
    },
    decimals: 6,
    name: "Aramid Algorand",
    symbol: "aALGO",
    logoPath: "/lovable-uploads/aALGO.png",
    tokenStandard: "asa",
  },
  aETH: {
    assetId: "302193",
    contractId: "40153308",
    poolId: "47139778",
    nTokenId: "47482429",
    migration: {
      contractId: "40153308",
      poolId: "41760711",
      nTokenId: "42682188",
    },
    decimals: 6,
    name: "Aramid ETH",
    symbol: "aETH",
    logoPath: "/lovable-uploads/aETH.png",
    tokenStandard: "asa",
  },
  aBTC: {
    assetId: "40152643",
    contractId: "40153368",
    poolId: "47139778",
    nTokenId: "48168253",
    migration: {
      contractId: "40153368",
      poolId: "41760711",
      nTokenId: "42701185",
    },
    decimals: 8,
    name: "Wrapped BTC",
    symbol: "aBTC",
    logoPath: "/lovable-uploads/WrappedBTC.png",
    tokenStandard: "asa",
  },
  acbBTC: {
    assetId: "40152648",
    contractId: "40153415",
    poolId: "47139778",
    nTokenId: "42706178",
    migration: {
      contractId: "40153415",
      poolId: "41760711",
      nTokenId: "42706178",
    },
    decimals: 8,
    name: "Coinbase BTC",
    symbol: "acbBTC",
    logoPath: "/lovable-uploads/cbBTC.png",
    tokenStandard: "asa",
  },
  POW: {
    assetId: "40152679",
    contractId: "40153155",
    poolId: "47139778",
    nTokenId: "47410637",
    migration: {
      poolId: "41760711",
      contractId: "40153155",
      nTokenId: "42702842",
    },
    decimals: 6,
    name: "POW",
    symbol: "POW",
    logoPath: "/lovable-uploads/POW.png",
    tokenStandard: "asa",
  },
  FV: {
    assetId: "0",
    contractId: "770561",
    poolId: "47139781",
    nTokenId: "",
    migration: {
      contractId: "770561",
      poolId: "44866061",
      nTokenId: "45052343",
    },
    decimals: 6,
    name: "Fountain VOI",
    symbol: "FV",
    logoPath: "https://asset-verification.nautilus.sh/icons/770561.png",
    tokenStandard: "network",
  },
  NV: {
    assetId: "0",
    contractId: "8324600",
    poolId: "47139781",
    nTokenId: "48174965",
    migration: {
      contractId: "8324600",
      poolId: "44866061",
      nTokenId: "45052477",
    },
    decimals: 6,
    name: "Nautilus VOI",
    symbol: "NV",
    logoPath: "/lovable-uploads/NV.png",
    tokenStandard: "network",
  },
  EV: {
    assetId: "0",
    contractId: "828295",
    poolId: "47139781",
    nTokenId: "",
    migration: {
      contractId: "828295",
      poolId: "44866061",
      nTokenId: "45447486",
    },
    decimals: 6,
    name: "enVOI",
    symbol: "EV",
    logoPath: "/lovable-uploads/EV.png",
    tokenStandard: "network",
  },
  bVOI: {
    assetId: "0",
    contractId: "8471125",
    poolId: "47139781",
    nTokenId: "48174861",
    migration: {
      contractId: "8471125",
      poolId: "44866061",
      nTokenId: "45052513",
    },
    decimals: 6,
    name: "BUIDL VOI",
    symbol: "bVOI",
    logoPath: "/lovable-uploads/bVOI.png",
    tokenStandard: "network",
  },
  NODE: {
    contractId: "410811",
    poolId: "47139781",
    nTokenId: "48174745",
    migration: {
      contractId: "410811",
      poolId: "44866061",
      nTokenId: "44872392",
    },
    decimals: 6,
    name: "NODE",
    symbol: "NODE",
    logoPath: "https://asset-verification.nautilus.sh/icons/410811.png",
    tokenStandard: "arc200",
  },
  BUIDL: {
    contractId: "419744",
    poolId: "47139781",
    nTokenId: "48174565",
    migration: {
      contractId: "419744",
      poolId: "44866061",
      nTokenId: "44872401",
    },
    decimals: 8,
    name: "BUIDL",
    symbol: "BUIDL",
    logoPath: "https://asset-verification.nautilus.sh/icons/419744.png",
    tokenStandard: "arc200",
  },
  SHELLY: {
    contractId: "410111",
    poolId: "47139781",
    nTokenId: "48169022",
    migration: {
      contractId: "410111",
      poolId: "44866061",
      nTokenId: "44872410",
    },
    decimals: 8,
    name: "SHELLY",
    symbol: "SHELLY",
    logoPath: "https://asset-verification.nautilus.sh/icons/410111.png",
    tokenStandard: "arc200",
  },
  AMMO: {
    contractId: "798968",
    poolId: "47139781",
    nTokenId: "48174796",
    migration: {
      contractId: "798968",
      poolId: "44866061",
      nTokenId: "44872488",
    },
    decimals: 6,
    name: "AMMO",
    symbol: "AMMO",
    logoPath: "https://asset-verification.nautilus.sh/icons/798968.png",
    tokenStandard: "arc200",
  },
  GM: {
    contractId: "300279",
    poolId: "47139781",
    nTokenId: "47467486",
    decimals: 2,
    migration: {
      contractId: "300279",
      poolId: "44866061",
      nTokenId: "44872696",
    },
    name: "GM",
    symbol: "GM",
    logoPath: "https://asset-verification.nautilus.sh/icons/300279.png",
    tokenStandard: "arc200",
  },
  CORN: {
    contractId: "412682",
    poolId: "47139781",
    nTokenId: "47475083",
    decimals: 6,
    migration: {
      contractId: "412682",
      poolId: "44866061",
      nTokenId: "44872738",
    },
    name: "CORN",
    symbol: "CORN",
    logoPath: "https://asset-verification.nautilus.sh/icons/412682.png",
    tokenStandard: "arc200",
  },
  F: {
    contractId: "302222",
    poolId: "47139781",
    nTokenId: "48174629",
    decimals: 6,
    migration: {
      contractId: "302222",
      poolId: "44866061",
      nTokenId: "44872864",
    },
    name: "F",
    symbol: "F",
    logoPath: "https://asset-verification.nautilus.sh/icons/302222.png",
    tokenStandard: "arc200",
  },
  IAT: {
    contractId: "420024",
    poolId: "47139781",
    nTokenId: "48174826",
    migration: {
      contractId: "420024",
      poolId: "44866061",
      nTokenId: "44872814",
    },
    decimals: 6,
    name: "IAT",
    symbol: "IAT",
    logoPath: "https://asset-verification.nautilus.sh/icons/420024.png",
    tokenStandard: "arc200",
  },
  WAD: [
    {
      // assetId: 47155831
      contractId: "47138068",
      poolId: "47139778",
      nTokenId: "47155328",
      decimals: 6,
      name: "WAD",
      symbol: "WAD",
      logoPath: "/lovable-uploads/WAD_fixed.png",
      tokenStandard: "arc200",
      isStoken: true,
    },
    {
      contractId: "47138068",
      poolId: "47139781",
      nTokenId: "47469357",
      decimals: 6,
      name: "WAD",
      symbol: "WAD",
      logoPath: "/lovable-uploads/WAD_fixed.png",
      tokenStandard: "arc200",
      hasRewards: true,
    },
  ],
};
const prodLendingPools = [prodAMarket, prodBMarket];
const prodContracts = {
  lendingPools: [...prodLendingPools],
  priceOracle: "47138069",
  liquidationEngine: undefined,
  governance: {
    appId: 48472636,
    storageAppId: 48458688,
    powerSources: [
      47148525, // UNIT nToken appId
    ],
    powerMultipliers: [
      { id: "dorks_v1", label: "Dorks v1", contractId: 313597, bonus: 0.169 },
      { id: "dorks_v2", label: "Dorks v2", contractId: 894888, bonus: 0.01 },
      { id: "chubs_v1", label: "Chubs v1", contractId: 313705, bonus: 0.15 },
    ],
  },
  treasury: undefined,
  marketController: "47138067",
  sToken: "47138068",
  appStorageId: "47138065",
};
const voiMainnetConfig: NetworkConfig = {
  ...baseVoiMainnetConfig,
  contracts: { ...prodContracts },
  tokens: { ...prodTokens },
  gasStation: [],
  preFiParameters: undefined,
};

/**
 * Algorand Mainnet Configuration (for reference)
 */
const algorandPrefiLendingPools = ["3207735602", "3212536201"];
const algorandPrefiTokens: Record<string, TokenConfig> = {
  ALGO: {
    assetId: "0",
    poolId: "3207735602",
    contractId: "3207744109",
    nTokenId: "3209220112",
    decimals: 6,
    name: "Algorand",
    symbol: "ALGO",
    logoPath: "/lovable-uploads/Algo.webp",
    tokenStandard: "network",
    marketOverride: {
      displayName: "Algo",
      displaySymbol: "Algo",
      isSmartContract: true,
    },
  },
  USDC: {
    assetId: "31566704",
    poolId: "3207735602",
    contractId: "3210682240",
    nTokenId: "3210686647",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
    logoPath: "/lovable-uploads/USDC.webp",
    tokenStandard: "asa",
  },
  aVOI: {
    assetId: "2320775407",
    poolId: "3207735602",
    contractId: "3210709899",
    nTokenId: "3210713754",
    decimals: 6,
    name: "Aramid VOI",
    symbol: "aVOI",
    logoPath: "/lovable-uploads/aVOI.webp",
    tokenStandard: "asa",
  },
  // new
  UNIT: {
    assetId: "3121954282",
    poolId: "3207735602",
    contractId: "3220125024",
    nTokenId: "3220137925",
    oldPoolId: "3207735602",
    oldContractId: "3210808778",
    oldNTokenId: "3210828987",
    decimals: 8,
    name: "UNIT",
    symbol: "UNIT",
    logoPath: "/lovable-uploads/UNIT.png",
    tokenStandard: "asa",
  },
  // old
  // UNIT: {
  //   assetId: "3121954282",
  //   poolId: "3207735602",
  //   contractId: "3210808778",
  //   nTokenId: "3210828987",
  //   decimals: 8,
  //   name: "UNIT",
  //   symbol: "UNIT",
  //   logoPath: "/lovable-uploads/UNIT.png",
  //   tokenStandard: "asa",
  // },
  POW: {
    assetId: "2994233666",
    poolId: "3207735602",
    contractId: "3080081069",
    nTokenId: "3210859195",
    decimals: 6,
    name: "POW",
    symbol: "POW",
    logoPath: "/lovable-uploads/POW.png",
    tokenStandard: "asa",
  },
  TINY: {
    assetId: "2200000000",
    poolId: "3207735602",
    contractId: "3211740909",
    nTokenId: "3211743044",
    decimals: 6,
    name: "TINY",
    symbol: "TINY",
    logoPath: "/lovable-uploads/TINY.webp",
    tokenStandard: "asa",
  },
  FINITE: {
    assetId: "400593267",
    poolId: "3207735602",
    contractId: "3211805086",
    nTokenId: "3211898346",
    decimals: 8,
    name: "FINITE",
    symbol: "FINITE",
    logoPath: "/lovable-uploads/FINITE.webp",
    tokenStandard: "asa",
  },
  COMPX: {
    assetId: "1732165149",
    poolId: "3207735602",
    contractId: "3211800950",
    nTokenId: "3212058626",
    decimals: 6,
    name: "COMPX",
    symbol: "COMPX",
    logoPath: "/lovable-uploads/COMPX.webp",
    tokenStandard: "asa",
  },
  goETH: {
    assetId: "386195940",
    poolId: "3207735602",
    contractId: "3211806149",
    nTokenId: "3211945252",
    decimals: 8,
    name: "goETH",
    symbol: "goETH",
    logoPath: "/lovable-uploads/goETH.webp",
    tokenStandard: "asa",
  },
  wETH: {
    assetId: "887406851",
    poolId: "3207735602",
    contractId: "3211811648",
    nTokenId: "3211959473",
    decimals: 8,
    name: "wETH",
    symbol: "wETH",
    logoPath: "/lovable-uploads/wETH.webp",
    tokenStandard: "asa",
  },
  goBTC: {
    assetId: "386192725",
    poolId: "3207735602",
    contractId: "3211820549",
    nTokenId: "3211970762",
    decimals: 8,
    name: "goBTC",
    symbol: "goBTC",
    logoPath: "/lovable-uploads/goBTC.webp",
    tokenStandard: "asa",
  },
  wBTC: {
    assetId: "1058926737",
    poolId: "3207735602",
    contractId: "3211827406",
    nTokenId: "3211979645",
    decimals: 8,
    name: "wBTC",
    symbol: "wBTC",
    logoPath: "/lovable-uploads/wBTCm.png",
    tokenStandard: "asa",
  },
  LINK: {
    assetId: "1200094857",
    poolId: "3207735602",
    contractId: "3211838479",
    nTokenId: "3212006089",
    decimals: 8,
    name: "LINK",
    symbol: "LINK",
    logoPath: "/lovable-uploads/LINK.png",
    tokenStandard: "asa",
  },
  SOL: {
    assetId: "887648583",
    poolId: "3207735602",
    contractId: "3211883276",
    nTokenId: "3212014226",
    decimals: 8,
    name: "SOL",
    symbol: "SOL",
    logoPath: "/lovable-uploads/SOL.png",
    tokenStandard: "asa",
  },
  AVAX: {
    assetId: "893309613",
    poolId: "3207735602",
    contractId: "3211885849",
    nTokenId: "3212025852",
    decimals: 8,
    name: "AVAX",
    symbol: "AVAX",
    logoPath: "/lovable-uploads/wAVAX.png",
    tokenStandard: "asa",
  },
  HAY: {
    assetId: "3160000000",
    poolId: "3207735602",
    contractId: "3211890928",
    nTokenId: "3212035193",
    decimals: 6,
    name: "HAY",
    symbol: "HAY",
    logoPath: "/lovable-uploads/wBTC.png",
    tokenStandard: "asa",
  },
  COOP: {
    assetId: "796425061",
    poolId: "3212536201",
    contractId: "3212524778",
    nTokenId: "3212561970",
    decimals: 6,
    name: "COOP",
    symbol: "COOP",
    logoPath: "/lovable-uploads/COOP.webp",
    tokenStandard: "asa",
  },
  MONKO: {
    assetId: "2494786278",
    poolId: "3212536201",
    contractId: "3212530444",
    nTokenId: "3212621493",
    decimals: 6,
    name: "MONKO",
    symbol: "MONKO",
    logoPath: "/lovable-uploads/MONKO.webp",
    tokenStandard: "asa",
  },
  ALPHA: {
    assetId: "2726252423",
    poolId: "3212536201",
    contractId: "3212531816",
    nTokenId: "3212642063",
    decimals: 6,
    name: "ALPHA",
    symbol: "ALPHA",
    logoPath: "/lovable-uploads/ALPHA.webp",
    tokenStandard: "asa",
  },
  AKTA: {
    assetId: "523683256",
    poolId: "3212536201",
    contractId: "3212534634",
    nTokenId: "3212658547",
    decimals: 6,
    name: "AKITA INU",
    symbol: "AKTA",
    logoPath: "/lovable-uploads/AKITA.webp",
    tokenStandard: "asa",
  },
  // BALLSACK: {
  //   assetId: "2656692124",
  //   poolId: "3212536201",
  //   contractId: "3212764299",
  //   nTokenId: "3212782401",
  //   decimals: 6,
  //   name: "BALLSACK",
  //   symbol: "BALLSACK",
  //   logoPath: "/lovable-uploads/BALLSACK.webp",
  //   tokenStandard: "asa",
  // },
  BRO: {
    assetId: "2637100337",
    poolId: "3212536201",
    contractId: "3212768756",
    nTokenId: "3212811911",
    decimals: 6,
    name: "BRO",
    symbol: "BRO",
    logoPath: "/lovable-uploads/BRO.webp",
    tokenStandard: "asa",
  },
  PEPE: {
    assetId: "1096015467",
    poolId: "3212536201",
    contractId: "3212771255",
    nTokenId: "3212818453",
    decimals: 4,
    name: "PEPE",
    symbol: "PEPE",
    logoPath: "/lovable-uploads/PEPE.webp",
    tokenStandard: "asa",
  },
  HOG: {
    assetId: "3178895177",
    poolId: "3212536201",
    contractId: "3212773584",
    nTokenId: "3212877734",
    decimals: 6,
    name: "HOG",
    symbol: "HOG",
    logoPath: "/lovable-uploads/HOG.webp",
    tokenStandard: "asa",
  },
  SCOUT: {
    assetId: "569120128",
    poolId: "3212536201",
    contractId: "3220313750",
    nTokenId: "3220327258",
    decimals: 6,
    name: "SCOUT",
    symbol: "SCOUT",
    logoPath:
      "https://algorand-wallet-mainnet.b-cdn.net/media/asset_verification_requests_logo_png/2022/06/30/f339b006471443f982e3f5bb22dea3ac.png?width=200&quality=70",
    tokenStandard: "asa",
  },
  GOLD$: {
    assetId: "246516580",
    poolId: "3212536201",
    contractId: "3220347315",
    nTokenId: "3220356360",
    decimals: 6,
    name: "GOLD$",
    symbol: "GOLD$",
    logoPath:
      "https://algorand-wallet-mainnet.b-cdn.net/media/assets-logo-png/2023/04/10/a5706bc6e41049a385d80468259ce1f4.png?width=200&quality=70",
    tokenStandard: "asa",
  },
};
const algorandPrefiContracts: ContractConfig = {
  lendingPools: algorandPrefiLendingPools,
  priceOracle: undefined,
  liquidationEngine: undefined,
  governance: undefined,
  treasury: undefined,
  sToken: undefined, // TODO: Add actual sToken app ID
  beacon: "3209233839",
};
const algorandMainnetPrefiConfig: NetworkConfig = {
  networkId: "algorand-mainnet",
  walletNetworkId: "mainnet",
  name: "Algorand Mainnet",
  networkType: "avm",
  rpcUrl: "https://mainnet-api.4160.nodely.dev",
  // rpcPublicUrl removed - using deprecated endpoint https://dork-algo-api.nautilus.sh
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://mainnet-idx.4160.nodely.dev",
  explorerUrl: "https://allo.info",
  contracts: algorandPrefiContracts,
  tokens: algorandPrefiTokens,
};
const algorandProdAMarket = "3333688282";
const algorandProdBMarket = "3345940978";
const algorandProdDMarket = "3526240577";
const algorandProdPriceOracle = "3333688500";
const algorandProdLiquidationEngine = undefined;
const algorandProdGovernance = {
  appId: 3436627998,
  storageAppId: 3436628276,
  powerSources: [
    3333783429, // UNIT nToken appId
  ],
  powerMultipliers: [],
}
const algorandProdTreasury = undefined;
const algorandProdMarketController = "3333688332";
const algorandProdSToken = "3333688448";
const algorandProdBeacon = "3209233839";
const algorandProdAppStorageId = "3333688254";
// A, B, D markets (C market slot not used on prod)
const algorandProdLendingPools = [
  algorandProdAMarket,
  algorandProdBMarket,
  algorandProdDMarket,
];
const algorandProdContracts: ContractConfig = {
  lendingPools: algorandProdLendingPools,
  priceOracle: algorandProdPriceOracle,
  liquidationEngine: algorandProdLiquidationEngine,
  governance: algorandProdGovernance,
  treasury: algorandProdTreasury,
  marketController: algorandProdMarketController,
  sToken: algorandProdSToken,
  beacon: algorandProdBeacon,
  appStorageId: algorandProdAppStorageId,
};

const algorandProdTokens: { [symbol: string]: TokenConfig | TokenConfig[] } = {
  ALGO: [{
    assetId: "0",
    poolId: "3333688282",
    contractId: "3207744109",
    nTokenId: "3333724131",
    migration: {
      poolId: "3207735602",
      contractId: "3207744109",
      nTokenId: "3209220112",
    },
    decimals: 6,
    name: "Algorand",
    symbol: "ALGO",
    logoPath: "/lovable-uploads/Algo.webp",
    tokenStandard: "network",
    marketOverride: {
      displayName: "Algo",
      displaySymbol: "Algo",
      isSmartContract: true,
    },
    hasRewards: true,
  },
  {
    assetId: "0",
    poolId: "3345940978",
    contractId: "3207744109",
    nTokenId: "3333724131",
    migration: {
      poolId: "3207735602",
      contractId: "3207744109",
      nTokenId: "3209220112",
    },
    decimals: 6,
    name: "Algorand",
    symbol: "ALGO",
    logoPath: "/lovable-uploads/Algo.webp",
    tokenStandard: "network",
    marketOverride: {
      displayName: "Algo",
      displaySymbol: "Algo",
      isSmartContract: true,
    },
    dataAddedAt: "2026-03-26T00:00:00.000Z",
  }, {
    assetId: "0",
    poolId: "3526240577",
    contractId: "3524740731",
    nTokenId: "3526254085",
    decimals: 6,
    name: "Algorand",
    symbol: "fALGO",
    logoPath: "/lovable-uploads/Algo.webp",
    tokenStandard: "network-asa",
    marketOverride: {
      displayName: "Algo",
      displaySymbol: "Algo",
      isSmartContract: true,
    },
    adapters: [
      FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET,
      FOLKS_MAINNET_ALGO_DEPOSIT_UNDERLYING,
      FOLKS_MAINNET_ALGO_WITHDRAW,
      FOLKS_MAINNET_ALGO_WITHDRAW_FASSET_WALLET,
      FOLKS_MAINNET_ALGO_BORROW_FASSET_WALLET,
      FOLKS_MAINNET_ALGO_BORROW_UNDERLYING,
      FOLKS_MAINNET_ALGO_REPAY_FASSET_WALLET,
      FOLKS_MAINNET_ALGO_REPAY_UNDERLYING,
    ],
    dataAddedAt: "2026-04-17T00:00:00.000Z",
    intrinsicApyPercent: 2.14,
    intrinsicApyLiveSource: "folks_mainnet_algo_pool_deposit",
    intrinsicBorrowApyPercent: 2.14,
    intrinsicBorrowApyLiveSource: "folks_mainnet_algo_pool_deposit",
    iconBadgeFromSymbol: "FOLKS",
  }],
  fALGO: {
    assetId: "971381860",
    poolId: "3333688282",
    contractId: "3524740731",
    nTokenId: "3526254085",
    decimals: 6,
    name: "Folks V2 ALGO",
    symbol: "fALGO",
    logoPath: "/lovable-uploads/Algo.webp",
    marketOverride: {
      displayName: "Algorand",
      displaySymbol: "Algo",
      isSmartContract: true,
    },
    tokenStandard: "asa",
    /**
     * Same Folks leg as the `network-asa` row under `tokens.ALGO[]` for this pool, so anything
     * that resolves `getTokenConfig("fALGO")` still sees adapter metadata. Supply/withdraw/borrow/repay UX
     * that offers per-adapter inputs should read {@link getFolksAdaptersForPhase} and pass
     * {@link tokenAdapterStableId} into `lendingService` for the matching phase.
     */
    adapters: [
      FOLKS_MAINNET_ALGO_DEPOSIT_FALGO_WALLET,
      FOLKS_MAINNET_ALGO_DEPOSIT_UNDERLYING,
      FOLKS_MAINNET_ALGO_WITHDRAW,
      FOLKS_MAINNET_ALGO_WITHDRAW_FASSET_WALLET,
      FOLKS_MAINNET_ALGO_BORROW_FASSET_WALLET,
      FOLKS_MAINNET_ALGO_BORROW_UNDERLYING,
      FOLKS_MAINNET_ALGO_REPAY_FASSET_WALLET,
      FOLKS_MAINNET_ALGO_REPAY_UNDERLYING,
    ],
    dataAddedAt: "2026-04-17T00:00:00.000Z",
    intrinsicApyPercent: 2.14,
    intrinsicBorrowApyPercent: 2.14,
    intrinsicBorrowApyLiveSource: "folks_mainnet_algo_pool_deposit",
    intrinsicApyLiveSource: "folks_mainnet_algo_pool_deposit",
    iconBadgeFromSymbol: "FOLKS",
  },
  /**
   * Tinyman tALGO: nt200 / lending use the tALGO ASA (`assetId`) directly — no Folks f-tALGO leg.
   * The supply modal offers a synthetic “deposit ALGO” route (Tinyman `mint`) that locks ALGO in the
   * [Tinyman liquid staking](https://github.com/tinymanorg/tinyman-consensus-staking) app (mainnet app
   * `2537013674`), mints tALGO, then calls the same `deposit()` path; see `TALGO_TINYMAN_DEPOSIT_ALGO_ROUTE_ID`
   * in `SupplyBorrowModal` / `talgoMintSupplySingleGroup`.
   */
  tALGO: {
    assetId: "2537013734",
    poolId: "3333688282",
    contractId: "3490783147",
    nTokenId: "3490789358",
    decimals: 6,
    name: "TALGO",
    symbol: "tALGO",
    marketOverride: {
      displayName: "Algorand",
      displaySymbol: "Algo",
      isSmartContract: true,
    },
    logoPath: "/lovable-uploads/Algo.webp",
    tokenStandard: "asa",
    dataAddedAt: "2026-03-23T00:00:00.000Z",
    intrinsicApyPercent: 4.51,
    intrinsicBorrowApyPercent: 4.51,
    intrinsicBorrowApyLiveSource: "tinyman_liquid_staking",
    intrinsicApyLiveSource: "tinyman_liquid_staking",
    iconBadgeFromSymbol: "tALGO",
  },
  /**
   * Governance xALGO: nt200 / lending use the xALGO ASA (`assetId`) directly — no Folks f-xALGO leg.
   * The supply modal still offers a synthetic “deposit ALGO” route (consensus `immediate_mint`) that
   * mints xALGO then calls the same `deposit()` path; see `XALGO_CONSENSUS_DEPOSIT_ALGO_ROUTE_ID` in
   * `SupplyBorrowModal` / `xalgoMintSupplySingleGroup` — not an entry in `adapters` (those are Folks-only).
   * Borrow modal: synthetic “receive ALGO” route appends consensus `burn` after `borrow` + withdraw;
   * see `XALGO_CONSENSUS_BORROW_ALGO_ROUTE_ID` and `xalgoBorrowBurnSingleGroup`.
   * Withdraw modal (portfolio): synthetic “receive ALGO” route appends consensus `burn` after nt200
   * withdraw; default route receives xALGO. See `XALGO_CONSENSUS_WITHDRAW_ALGO_ROUTE_ID` in
   * `WithdrawModal` / `lendingService.withdraw`.
   * Repay modal (portfolio): synthetic “repay with ALGO” route prepends consensus `immediate_mint`
   * then nt200 deposit + repay; default repays with wallet xALGO. See `XALGO_CONSENSUS_REPAY_ALGO_ROUTE_ID`
   * in `RepayModal` / `lendingService.repay`.
   */
  xALGO: {
    assetId: "1134696561",
    poolId: "3333688282",
    contractId: "3490854290",
    nTokenId: "3490863151",
    decimals: 6,
    name: "Governance xALGO",
    symbol: "xALGO",
    marketOverride: {
      displayName: "Algorand",
      displaySymbol: "Algo",
      isSmartContract: true,
    },
    logoPath: "/lovable-uploads/Algo.webp",
    tokenStandard: "asa",
    requireStandaloneMarketAsaOptInBeforeDeposit: true,
    dataAddedAt: "2026-03-23T00:00:00.000Z",
    intrinsicApyPercent: 4.49,
    intrinsicBorrowApyPercent: 4.49,
    intrinsicBorrowApyLiveSource: "xalgo_governance_lambda",
    intrinsicApyLiveSource: "xalgo_governance_lambda",
  },
  USDC: [{
    assetId: "31566704",
    poolId: "3333688282",
    contractId: "3210682240",
    nTokenId: "3333764003",
    migration: {
      poolId: "3207735602",
      contractId: "3210682240",
      nTokenId: "3210686647",
    },
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
    logoPath: "/lovable-uploads/USDC.webp",
    tokenStandard: "asa",
  }, {
    assetId: "31566704",
    poolId: "3345940978",
    contractId: "3210682240",
    nTokenId: "3494389084",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
    logoPath: "/lovable-uploads/USDC.webp",
    tokenStandard: "asa",
    dataAddedAt: "2026-03-26T00:00:00.000Z",
  }],
  fUSDC: [{
    assetId: "971384592",
    poolId: "3333688282",
    contractId: "3527735223",
    nTokenId: "3527764569",
    decimals: 6,
    name: "Folks V2 USDC",
    symbol: "fUSDC",
    logoPath: "/lovable-uploads/USDC.webp",
    marketOverride: {
      displayName: "USD Coin",
      displaySymbol: "USDC",
      isSmartContract: true,
    },
    tokenStandard: "asa",
    /**
     * Same Folks leg as the `asa-asa` row under `tokens.USDC[]` for this pool, so
     * `getTokenConfig("fUSDC")` resolves adapter metadata for mint-ratio / route pickers.
     */
    adapters: [
      FOLKS_MAINNET_USDC_DEPOSIT_FUSDC_WALLET,
      FOLKS_MAINNET_USDC_DEPOSIT_UNDERLYING,
      FOLKS_MAINNET_USDC_WITHDRAW,
      FOLKS_MAINNET_USDC_WITHDRAW_FASSET_WALLET,
      FOLKS_MAINNET_USDC_BORROW_FUSDC_WALLET,
      FOLKS_MAINNET_USDC_BORROW_UNDERLYING,
      FOLKS_MAINNET_USDC_REPAY_FUSDC_WALLET,
      FOLKS_MAINNET_USDC_REPAY_UNDERLYING,
    ],
    dataAddedAt: "2026-04-19T00:00:00.000Z",
    intrinsicApyPercent: 3.48,
    intrinsicBorrowApyPercent: 3.48,
    intrinsicApyLiveSource: "folks_mainnet_usdc_pool_deposit",
    intrinsicBorrowApyLiveSource: "folks_mainnet_usdc_pool_borrow",
    iconBadgeFromSymbol: "FOLKS",
  },
  {
    assetId: "31566704",
    poolId: "3526240577",
    contractId: "3527735223",
    nTokenId: "3527752141",
    decimals: 6,
    name: "Folks V2 USDC",
    symbol: "fUSDC",
    marketOverride: {
      displayName: "USD Coin",
      displaySymbol: "USDC",
      isSmartContract: true,
    },
    logoPath: "/lovable-uploads/USDC.webp",
    tokenStandard: "asa-asa",
    requireStandaloneFAssetOptInBeforeDeposit: true,
    adapters: [
      FOLKS_MAINNET_USDC_DEPOSIT_FUSDC_WALLET,
      FOLKS_MAINNET_USDC_DEPOSIT_UNDERLYING,
      FOLKS_MAINNET_USDC_WITHDRAW,
      FOLKS_MAINNET_USDC_WITHDRAW_FASSET_WALLET,
      FOLKS_MAINNET_USDC_BORROW_FUSDC_WALLET,
      FOLKS_MAINNET_USDC_BORROW_UNDERLYING,
      FOLKS_MAINNET_USDC_REPAY_FUSDC_WALLET,
      FOLKS_MAINNET_USDC_REPAY_UNDERLYING,
    ],
    dataAddedAt: "2026-04-19T00:00:00.000Z",
    intrinsicApyPercent: 3.48,
    intrinsicBorrowApyPercent: 3.48,
    intrinsicApyLiveSource: "folks_mainnet_usdc_pool_deposit",
    intrinsicBorrowApyLiveSource: "folks_mainnet_usdc_pool_borrow",
    iconBadgeFromSymbol: "FOLKS",
  }, {
    assetId: "31566704",
    poolId: "3333688282",
    contractId: "3527735223",
    nTokenId: "3527764569",
    decimals: 6,
    name: "Folks V2 USDC",
    symbol: "fUSDC",
    marketOverride: {
      displayName: "USD Coin",
      displaySymbol: "USDC",
      isSmartContract: true,
    },
    logoPath: "/lovable-uploads/USDC.webp",
    tokenStandard: "asa-asa",
    requireStandaloneFAssetOptInBeforeDeposit: true,
    adapters: [
      FOLKS_MAINNET_FIUSDC_DEPOSIT_FIUSDC_WALLET,
      FOLKS_MAINNET_FIUSDC_DEPOSIT_UNDERLYING,
      FOLKS_MAINNET_FIUSDC_WITHDRAW,
      FOLKS_MAINNET_FIUSDC_WITHDRAW_FASSET_WALLET,
      FOLKS_MAINNET_FIUSDC_BORROW_FIUSDC_WALLET,
      FOLKS_MAINNET_FIUSDC_BORROW_UNDERLYING,
      FOLKS_MAINNET_FIUSDC_REPAY_FIUSDC_WALLET,
      FOLKS_MAINNET_FIUSDC_REPAY_UNDERLYING,
    ],
    dataAddedAt: "2026-04-29T00:00:00.000Z",
    intrinsicApyPercent: 7.78,
    intrinsicBorrowApyPercent: 7.78,
    intrinsicApyLiveSource: "folks_mainnet_fiusdc_ecosystem_pool_deposit",
    intrinsicBorrowApyLiveSource: "folks_mainnet_fiusdc_ecosystem_pool_borrow",
    iconBadgeFromSymbol: "FOLKS",
  }
  ],
  fiUSDC: {
    assetId: "3184331239",
    poolId: "3333688282",
    contractId: "3540156071",
    nTokenId: "3540213205",
    decimals: 6,
    name: "Folks V2 Isolated USDC",
    symbol: "fiUSDC",
    logoPath: "/lovable-uploads/USDC.webp",
    marketOverride: {
      displayName: "USD Coin",
      displaySymbol: "USDC",
      isSmartContract: true,
    },
    tokenStandard: "asa",
    requireStandaloneFAssetOptInBeforeDeposit: true,
    /**
     * Same Folks leg as the `asa-asa` row under `tokens.USDC[]` for this pool, using
     * Folks Algorand Ecosystem USDC deposit ids (fiUSDC f-ASA).
     */
    adapters: [
      FOLKS_MAINNET_FIUSDC_DEPOSIT_FIUSDC_WALLET,
      FOLKS_MAINNET_FIUSDC_DEPOSIT_UNDERLYING,
      FOLKS_MAINNET_FIUSDC_WITHDRAW,
      FOLKS_MAINNET_FIUSDC_WITHDRAW_FASSET_WALLET,
      FOLKS_MAINNET_FIUSDC_BORROW_FIUSDC_WALLET,
      FOLKS_MAINNET_FIUSDC_BORROW_UNDERLYING,
      FOLKS_MAINNET_FIUSDC_REPAY_FIUSDC_WALLET,
      FOLKS_MAINNET_FIUSDC_REPAY_UNDERLYING,
    ],
    dataAddedAt: "2026-04-29T00:00:00.000Z",
    intrinsicApyPercent: 7.78,
    intrinsicBorrowApyPercent: 7.78,
    intrinsicApyLiveSource: "folks_mainnet_fiusdc_ecosystem_pool_deposit",
    intrinsicBorrowApyLiveSource: "folks_mainnet_fiusdc_ecosystem_pool_borrow",
    iconBadgeFromSymbol: "FOLKS",
  },
  UNIT: {
    assetId: "3121954282",
    poolId: "3333688282",
    contractId: "3220125024",
    nTokenId: "3333783429",
    migration: {
      poolId: "3207735602",
      contractId: "3220125024",
      nTokenId: "3220137925",
    },
    decimals: 8,
    name: "UNIT",
    symbol: "UNIT",
    logoPath: "/lovable-uploads/UNIT.png",
    tokenStandard: "asa",
  },
  aVOI: {
    assetId: "2320775407",
    poolId: "3333688282",
    contractId: "3210709899",
    nTokenId: "3347224631",
    migration: {
      poolId: "3207735602",
      contractId: "3210709899",
      nTokenId: "3210713754",
    },
    decimals: 6,
    name: "Aramid VOI",
    symbol: "aVOI",
    logoPath: "/lovable-uploads/aVOI.webp",
    tokenStandard: "asa",
  },
  POW: {
    assetId: "2994233666",
    poolId: "3333688282",
    contractId: "3080081069",
    nTokenId: "3345339041",
    migration: {
      poolId: "3207735602",
      contractId: "3080081069",
      nTokenId: "3210859195",
    },
    decimals: 6,
    name: "POW",
    symbol: "POW",
    logoPath: "/lovable-uploads/POW.png",
    tokenStandard: "asa",
  },
  TINY: {
    assetId: "2200000000",
    poolId: "3345940978",
    contractId: "3211740909",
    nTokenId: "3389215333",
    migration: {
      poolId: "3207735602",
      contractId: "3211740909",
      nTokenId: "3211743044",
    },
    decimals: 6,
    name: "TINY",
    symbol: "TINY",
    logoPath: "/lovable-uploads/TINY.webp",
    tokenStandard: "asa",
  },
  FINITE: [{
    assetId: "400593267",
    poolId: "3345940978",
    contractId: "3211805086",
    nTokenId: "3346001205",
    migration: {
      poolId: "3207735602",
      contractId: "3211805086",
      nTokenId: "3211898346",
    },
    decimals: 8,
    name: "FINITE",
    symbol: "FINITE",
    logoPath: "/lovable-uploads/FINITE.webp",
    tokenStandard: "asa",
  },
  {
    assetId: "400593267",
    poolId: "3333688282",
    contractId: "3211805086",
    nTokenId: "3346001205",
    decimals: 8,
    name: "FINITE",
    symbol: "FINITE",
    logoPath: "/lovable-uploads/FINITE.webp",
    tokenStandard: "asa",
    dataAddedAt: "2026-04-11T00:00:00.000Z",
  }
  ],
  COMPX: {
    assetId: "1732165149",
    poolId: "3345940978",
    contractId: "3211800950",
    nTokenId: "3212058626",
    migration: {
      poolId: "3207735602",
      contractId: "3211800950",
      nTokenId: "3212058626",
    },
    decimals: 6,
    name: "COMPX",
    symbol: "COMPX",
    logoPath: "/lovable-uploads/COMPX.webp",
    tokenStandard: "asa",
  },
  goETH: {
    assetId: "386195940",
    poolId: "3333688282",
    contractId: "3211806149",
    nTokenId: "3348091978",
    migration: {
      poolId: "3207735602",
      contractId: "3211806149",
      nTokenId: "3211945252",
    },
    decimals: 8,
    name: "goETH",
    symbol: "goETH",
    logoPath: "/lovable-uploads/goETH.webp",
    tokenStandard: "asa",
  },
  wETH: {
    assetId: "887406851",
    poolId: "3333688282",
    contractId: "3211811648",
    nTokenId: "3348121075",
    migration: {
      poolId: "3207735602",
      contractId: "3211811648",
      nTokenId: "3211959473",
    },
    decimals: 8,
    name: "wETH",
    symbol: "wETH",
    logoPath: "/lovable-uploads/wETH.webp",
    tokenStandard: "asa",
  },
  goBTC: {
    assetId: "386192725",
    poolId: "3333688282",
    contractId: "3211820549",
    nTokenId: "3345872342",
    migration: {
      poolId: "3207735602",
      contractId: "3211820549",
      nTokenId: "3211970762",
    },
    decimals: 8,
    name: "goBTC",
    symbol: "goBTC",
    logoPath: "/lovable-uploads/goBTC.webp",
    tokenStandard: "asa",
  },
  wBTC: {
    assetId: "1058926737",
    poolId: "3333688282",
    contractId: "3211827406",
    nTokenId: "3348042762",
    migration: {
      poolId: "3207735602",
      contractId: "3211827406",
      nTokenId: "3211979645",
    },
    decimals: 8,
    name: "wBTC",
    symbol: "wBTC",
    logoPath: "/lovable-uploads/wBTCm.png",
    tokenStandard: "asa",
  },
  LINK: {
    assetId: "1200094857",
    poolId: "3333688282",
    contractId: "3211838479",
    nTokenId: "3348498326",
    migration: {
      poolId: "3207735602",
      contractId: "3211838479",
      nTokenId: "3212006089",
    },
    decimals: 8,
    name: "LINK",
    symbol: "LINK",
    logoPath: "/lovable-uploads/LINK.png",
    tokenStandard: "asa",
  },
  SOL: {
    assetId: "887648583",
    poolId: "3333688282",
    contractId: "3211883276",
    nTokenId: "3348607970",
    migration: {
      poolId: "3207735602",
      contractId: "3211883276",
      nTokenId: "3212014226",
    },
    decimals: 8,
    name: "SOL",
    symbol: "SOL",
    logoPath: "/lovable-uploads/SOL.png",
    tokenStandard: "asa",
  },
  AVAX: {
    assetId: "893309613",
    poolId: "3333688282",
    contractId: "3211885849",
    nTokenId: "3352584524",
    migration: {
      poolId: "3207735602",
      contractId: "3211885849",
      nTokenId: "3212025852",
    },
    decimals: 8,
    name: "AVAX",
    symbol: "AVAX",
    logoPath: "/lovable-uploads/wAVAX.png",
    tokenStandard: "asa",
  },
  HAY: {
    assetId: "3160000000",
    poolId: "3345940978",
    contractId: "3211890928",
    nTokenId: "3347112042",
    migration: {
      poolId: "3207735602",
      contractId: "3211890928",
      nTokenId: "3212035193",
    },
    decimals: 6,
    name: "HAY",
    symbol: "HAY",
    logoPath: "/lovable-uploads/HAY.webp",
    tokenStandard: "asa",
  },
  COOP: {
    assetId: "796425061",
    poolId: "3345940978",
    contractId: "3212524778",
    nTokenId: "3346359997",
    migration: {
      poolId: "3212536201",
      contractId: "3212524778",
      nTokenId: "3212561970",
    },
    decimals: 6,
    name: "COOP",
    symbol: "COOP",
    logoPath: "/lovable-uploads/COOP.webp",
    tokenStandard: "asa",
  },
  // MONKO: {
  //   assetId: "2494786278",
  //   poolId: "3345940978",
  //   contractId: "3212530444",
  //   nTokenId: "3347032952",
  //   migration: {
  //     poolId: "3212536201",
  //     contractId: "3212530444",
  //     nTokenId: "3212621493",
  //   },
  //   decimals: 6,
  //   name: "MONKO",
  //   symbol: "MONKO",
  //   logoPath: "/lovable-uploads/MONKO.webp",
  //   tokenStandard: "asa",
  // },
  ALPHA: {
    assetId: "2726252423",
    poolId: "3345940978",
    contractId: "3212531816",
    nTokenId: "3347348052",
    migration: {
      poolId: "3212536201",
      contractId: "3212531816",
      nTokenId: "3212642063",
    },
    decimals: 6,
    name: "ALPHA",
    symbol: "ALPHA",
    logoPath: "/lovable-uploads/ALPHA.webp",
    tokenStandard: "asa",
  },
  AKTA: {
    assetId: "523683256",
    poolId: "3345940978",
    contractId: "3212534634",
    nTokenId: "3347802615",
    migration: {
      poolId: "3212536201",
      contractId: "3212534634",
      nTokenId: "3212658547",
    },
    decimals: 6,
    name: "AKITA INU",
    symbol: "AKTA",
    logoPath: "/lovable-uploads/AKITA.webp",
    tokenStandard: "asa",
  },
  BRO: {
    assetId: "2637100337",
    poolId: "3345940978",
    contractId: "3212768756",
    nTokenId: "3347182161",
    migration: {
      poolId: "3212536201",
      contractId: "3212768756",
      nTokenId: "3212811911",
    },
    decimals: 6,
    name: "BRO",
    symbol: "BRO",
    logoPath: "/lovable-uploads/BRO.webp",
    tokenStandard: "asa",
  },
  PEPE: {
    assetId: "1096015467",
    poolId: "3345940978",
    contractId: "3212771255",
    nTokenId: "3347856501",
    migration: {
      poolId: "3212536201",
      contractId: "3212771255",
      nTokenId: "3212818453",
    },
    decimals: 4,
    name: "PEPE",
    symbol: "PEPE",
    logoPath: "/lovable-uploads/PEPE.webp",
    tokenStandard: "asa",
  },
  HOG: {
    assetId: "3178895177",
    poolId: "3345940978",
    contractId: "3212773584",
    nTokenId: "3346388982",
    migration: {
      poolId: "3212536201",
      contractId: "3212773584",
      nTokenId: "3212877734",
    },
    decimals: 6,
    name: "HOG",
    symbol: "HOG",
    logoPath: "/lovable-uploads/HOG.webp",
    tokenStandard: "asa",
  },
  GOLD$: {
    assetId: "246516580",
    poolId: "3345940978",
    contractId: "3220347315",
    nTokenId: "3347951758",
    migration: {
      poolId: "3212536201",
      contractId: "3220347315",
      nTokenId: "3220356360",
    },
    decimals: 6,
    name: "GOLD$",
    symbol: "GOLD$",
    logoPath:
      "https://algorand-wallet-mainnet.b-cdn.net/media/assets-logo-png/2023/04/10/a5706bc6e41049a385d80468259ce1f4.png?width=200&quality=70",
    tokenStandard: "asa",
  },
  FOLKS: {
    assetId: "3203964481",
    poolId: "3345940978",
    contractId: "3346185062",
    nTokenId: "3346216929",
    decimals: 6,
    name: "FOLKS",
    symbol: "FOLKS",
    logoPath: "/lovable-uploads/FOLKS.png",
    tokenStandard: "asa",
  },
  USDt: {
    assetId: "312769",
    poolId: "3345940978",
    contractId: "3346408431",
    nTokenId: "3346410585",
    decimals: 6,
    name: "USDt",
    symbol: "USDt",
    logoPath: "/lovable-uploads/USDt.webp",
    tokenStandard: "asa",
  },
  xUSD: {
    assetId: "760037151",
    poolId: "3345940978",
    contractId: "3346881192",
    nTokenId: "3346887893",
    decimals: 6,
    name: "xUSD",
    symbol: "xUSD",
    logoPath: "/lovable-uploads/xUSD.webp",
    tokenStandard: "asa",
  },
  WAD: [
    {
      assetId: "3334160924",
      contractId: "3333688448",
      poolId: "3333688282",
      nTokenId: "3333919084",
      decimals: 6,
      name: "WAD",
      symbol: "WAD",
      logoPath: "/lovable-uploads/WAD_fixed.png",
      tokenStandard: "arc200-exchange",
      isStoken: true,
    },
    {
      assetId: "3334160924",
      contractId: "3333688448",
      poolId: "3345940978",
      nTokenId: "3350640542",
      decimals: 6,
      name: "WAD",
      symbol: "WAD",
      logoPath: "/lovable-uploads/WAD_fixed.png",
      tokenStandard: "arc200-exchange",
    },
    {
      assetId: "3334160924",
      contractId: "3333688448",
      poolId: "3526240577",
      nTokenId: "3527318445",
      decimals: 6,
      name: "WAD",
      symbol: "WAD",
      logoPath: "/lovable-uploads/WAD_fixed.png",
      tokenStandard: "arc200-exchange",
      dataAddedAt: "2026-04-19T00:00:00.000Z",
    },
  ],
};
const algorandMainnetProdConfig: NetworkConfig = {
  networkId: "algorand-mainnet",
  walletNetworkId: "mainnet",
  name: "Algorand Mainnet",
  networkType: "avm",
  rpcUrl: "https://mainnet-api.algorand.dork.fi",
  rpcPublicUrl: "https://mainnet-api.algorand.dork.fi",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://mainnet-idx.4160.nodely.dev",
  explorerUrl: "https://allo.info",
  contracts: algorandProdContracts,
  tokens: algorandProdTokens,
};
const algorandMainnetConfig = algorandMainnetProdConfig;

/**
 * Algorand Testnet Configuration (for reference)
 */
const algorandTestnetConfig: NetworkConfig = {
  networkId: "algorand-testnet",
  walletNetworkId: "testnet",
  name: "Algorand Testnet",
  networkType: "avm",
  rpcUrl: "https://testnet-api.algonode.cloud",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://testnet-idx.algonode.cloud",
  explorerUrl: "https://testnet.algoexplorer.io",
  contracts: {
    lendingPools: ["ALGORAND_TESTNET_LENDING_POOL_ID"], // TODO: Replace with actual contract ID
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
    sToken: undefined, // TODO: Add actual sToken app ID
  },
  tokens: {
    ALGO: {
      assetId: undefined, // Native token
      poolId: "ALGORAND_LENDING_POOL_ID", // TODO: Replace with actual pool ID
      decimals: 6,
      name: "Algorand",
      symbol: "ALGO",
      logoPath: "/lovable-uploads/Algo.webp",
      tokenStandard: "network",
    },
  },
};

/**
 * Base Mainnet Configuration (EVM)
 */
const baseMainnetConfig: NetworkConfig = {
  networkId: "base-mainnet",
  walletNetworkId: "base-mainnet",
  name: "Base Mainnet",
  networkType: "evm",
  rpcUrl: "https://mainnet.base.org",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://base-mainnet.g.alchemy.com/v2/demo", // Using Alchemy as indexer
  explorerUrl: "https://basescan.org",
  contracts: {
    lendingPools: [
      "0x1234567890123456789012345678901234567890",
      "0x2345678901234567890123456789012345678901",
    ], // Multiple pools for demonstration
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
    sToken: undefined, // TODO: Add actual sToken contract address
  },
  tokens: {
    ETH: {
      assetId: undefined, // Native token
      poolId: "ETHEREUM_LENDING_POOL_ID", // TODO: Replace with actual pool ID
      decimals: 18,
      name: "Ethereum",
      symbol: "ETH",
      logoPath: "/lovable-uploads/ETH.jpg",
      tokenStandard: "network",
    },
    USDC: {
      assetId: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
      poolId: "USDC_LENDING_POOL_ID", // TODO: Replace with actual pool ID
      decimals: 6,
      name: "USD Coin",
      symbol: "USDC",
      logoPath: "/lovable-uploads/aUSDC.png",
      tokenStandard: "arc200",
    },
  },
};

/**
 * Base Testnet Configuration (EVM)
 */
const baseTestnetConfig: NetworkConfig = {
  networkId: "base-testnet",
  walletNetworkId: "base-testnet",
  name: "Base Testnet",
  networkType: "evm",
  rpcUrl: "https://sepolia.base.org",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://base-sepolia.g.alchemy.com/v2/demo",
  explorerUrl: "https://sepolia.basescan.org",
  contracts: {
    lendingPools: ["0x1234567890123456789012345678901234567890"], // TODO: Replace with actual testnet contract address
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
    sToken: undefined, // TODO: Add actual sToken contract address
  },
  tokens: {
    ETH: {
      assetId: undefined, // Native token
      poolId: "ETHEREUM_LENDING_POOL_ID", // TODO: Replace with actual pool ID
      decimals: 18,
      name: "Ethereum",
      symbol: "ETH",
      logoPath: "/lovable-uploads/ETH.jpg",
      tokenStandard: "network",
    },
  },
};

/**
 * Ethereum Mainnet Configuration (EVM)
 */
const ethereumMainnetConfig: NetworkConfig = {
  networkId: "ethereum-mainnet",
  walletNetworkId: "ethereum-mainnet",
  name: "Ethereum Mainnet",
  networkType: "evm",
  rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/demo",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://eth-mainnet.g.alchemy.com/v2/demo",
  explorerUrl: "https://etherscan.io",
  contracts: {
    lendingPools: ["0x1234567890123456789012345678901234567890"], // TODO: Replace with actual contract address
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
    sToken: undefined, // TODO: Add actual sToken contract address
  },
  tokens: {
    ETH: {
      assetId: undefined, // Native token
      poolId: "ETHEREUM_LENDING_POOL_ID", // TODO: Replace with actual pool ID
      decimals: 18,
      name: "Ethereum",
      symbol: "ETH",
      logoPath: "/lovable-uploads/ETH.jpg",
      tokenStandard: "network",
    },
    USDC: {
      assetId: "0xA0b86a33E6441b8c4C8C0e4A0b86a33E6441b8c4C", // Ethereum USDC
      decimals: 6,
      name: "USD Coin",
      symbol: "USDC",
      logoPath: "/lovable-uploads/aUSDC.png",
      tokenStandard: "arc200",
    },
  },
};

/**
 * Ethereum Testnet Configuration (EVM)
 */
const ethereumTestnetConfig: NetworkConfig = {
  networkId: "ethereum-testnet",
  walletNetworkId: "ethereum-testnet",
  name: "Ethereum Sepolia",
  networkType: "evm",
  rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/demo",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://eth-sepolia.g.alchemy.com/v2/demo",
  explorerUrl: "https://sepolia.etherscan.io",
  contracts: {
    lendingPools: ["0x1234567890123456789012345678901234567890"], // TODO: Replace with actual testnet contract address
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
    sToken: undefined, // TODO: Add actual sToken contract address
  },
  tokens: {
    ETH: {
      assetId: undefined, // Native token
      poolId: "ETHEREUM_LENDING_POOL_ID", // TODO: Replace with actual pool ID
      decimals: 18,
      name: "Ethereum",
      symbol: "ETH",
      logoPath: "/lovable-uploads/ETH.jpg",
      tokenStandard: "network",
    },
  },
};

/**
 * Localnet Configuration (for local development)
 */
const localnetConfig: NetworkConfig = {
  networkId: "localnet",
  walletNetworkId: "local",
  name: "Local Development Network",
  networkType: "avm",
  rpcUrl: "http://localhost:8080",
  rpcPort: 8080,
  rpcToken: undefined, // Local development, no token required
  indexerUrl: "http://localhost:8980",
  explorerUrl: "http://localhost:3000",
  contracts: {
    lendingPools: ["LOCAL_LENDING_POOL_ID"], // TODO: Replace with actual local contract ID
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
    sToken: undefined, // TODO: Add actual sToken app ID
  },
  tokens: {
    ALGO: {
      assetId: undefined, // Native token
      poolId: "ALGORAND_LENDING_POOL_ID", // TODO: Replace with actual pool ID
      decimals: 6,
      name: "Algorand",
      symbol: "ALGO",
      logoPath: "/lovable-uploads/Algo.webp",
      tokenStandard: "network",
    },
    VOI: {
      assetId: undefined, // Native token
      decimals: 6,
      name: "VOI",
      symbol: "VOI",
      logoPath: "/lovable-uploads/VOI.png",
      tokenStandard: "network",
    },
  },
};

/**
 * Global Configuration Object
 */
const prefiNetworks = ["voi-mainnet", "algorand-mainnet"];
const betaNetworks = ["voi-mainnet"];
const enabledNetworks = ["voi-mainnet", "algorand-mainnet"];
export const config: GlobalConfig = {
  networks: {
    "voi-mainnet": voiMainnetConfig,
    "algorand-mainnet": algorandMainnetConfig,
    "algorand-testnet": algorandTestnetConfig,
    "base-mainnet": baseMainnetConfig,
    "base-testnet": baseTestnetConfig,
    "ethereum-mainnet": ethereumMainnetConfig,
    "ethereum-testnet": ethereumTestnetConfig,
    localnet: localnetConfig,
  },
  defaultNetwork: "voi-mainnet",
  enabledNetworks: [...enabledNetworks] as NetworkId[],
  version: "1.0.0",
  features: {
    enablePreFi: false,
    enableLiquidations: false,
    enableSwap: false,
    enableGovernance: true, // Governance UI enabled
    enableMigration: true, // Enable asset migration feature
    enableGasStation: false,
    enableNFTBoost: true, // Enable NFT boost for governance voting power
    enableLiquidatablePositions: true, // Enable liquidatable positions section in portfolio
  },
};

/**
 * Market label mapping: maps networkId-poolId combinations to market labels (A, B, etc.)
 * Format: "networkId-poolId" -> "A" | "B" | ...
 */
export const marketLabelMap: Record<string, string> = {
  // VOI Mainnet
  "voi-mainnet-41760711": "A",
  "voi-mainnet-44866061": "B",
  // Algorand Mainnet (prod pools in this file)
  "algorand-mainnet-3333688282": "A",
  "algorand-mainnet-3345940978": "B",
  /** Third prod lending pool (array order is A, B, D — no “C” market id). */
  "algorand-mainnet-3526240577": "D",
};

/**
 * Normalizes a rewards app origin: trim and remove trailing slashes. Callers should join paths with a
 * single `/` when appending routes.
 */
export const normalizeRewardsPublicBaseUrl = (origin: string): string =>
  origin.trim().replace(/\/+$/, "");

/**
 * Default hostname for rewards UI URLs (`https://{instanceId}.{host}`). Override with
 * `VITE_REWARDS_PROVIDER_HOST` (host only, no scheme).
 */
export const DEFAULT_REWARDS_PROVIDER_HOST = "rewards.nautilus.sh";

function normalizeRewardsProviderHostInput(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      return new URL(s).hostname.replace(/\/+$/, "");
    }
  } catch {
    // fall through
  }
  return s.replace(/^\/+/, "").replace(/\/+$/, "").split("/")[0] ?? "";
}

/**
 * Hostname for Nautilus-style rewards deployments (`{instanceId}.{host}`). Set `VITE_REWARDS_PROVIDER_HOST`
 * to point at another provider or staging host; defaults to `rewards.nautilus.sh`.
 */
export function getRewardsPublicProviderHost(): string {
  const raw =
    typeof import.meta.env.VITE_REWARDS_PROVIDER_HOST === "string"
      ? import.meta.env.VITE_REWARDS_PROVIDER_HOST
      : "";
  const normalized = normalizeRewardsProviderHostInput(raw);
  return normalized !== "" ? normalized : DEFAULT_REWARDS_PROVIDER_HOST;
}

/**
 * Turns a registry value into a full HTTPS origin: either a full URL or an instance id
 * `https://{instanceId}.{getRewardsPublicProviderHost()}`.
 */
export function resolveRewardsRegistryEntryToOrigin(
  registryValue: string,
  providerHostOverride?: string
): string {
  const v = registryValue.trim();
  if (!v) {
    return "";
  }
  if (/^https?:\/\//i.test(v)) {
    return normalizeRewardsPublicBaseUrl(v);
  }
  const host = providerHostOverride ?? getRewardsPublicProviderHost();
  const instance = v.replace(/^\.+/, "").replace(/\/+$/, "");
  return normalizeRewardsPublicBaseUrl(`https://${instance}.${host}`);
}

/**
 * Map from `networkId:poolId:contractId` (rewards `explorer-config` / `dorkfi` cohort) to deployment
 * instance id or full HTTPS origin.
 */
export const REWARDS_PROGRAM_PUBLIC_BASE_URL_REGISTRY: Record<string, string> = {
  // ALGO @ A market — matches rewards API `dorkfi` cohort (algorand-mainnet / pool / contract)
  "algorand-mainnet:3333688282:3207744109": "fa00f0044fc97455",
  // Algorand mainnet — B market WAD (`hasRewards` row for WAD @ pool 47139781)
  "algorand-mainnet:47139781:47138068": "fa00f0044fc97455",
};

/** Fields used when resolving rewards URLs from a token row (see {@link getRewardsProgramPublicBaseUrl}). */
export type TokenRewardsUrlFields = Pick<
  TokenConfig,
  "rewardsPublicBaseUrl" | "rewardsInstanceId"
>;

/**
 * Single resolver: `(networkId, poolId, contractId)` → public rewards app origin, or `null` if none.
 *
 * **Priority (highest first):**
 * 1. `token.rewardsPublicBaseUrl` — full origin; ignores registry and provider host.
 * 2. `token.rewardsInstanceId` — `{instance}.{VITE_REWARDS_PROVIDER_HOST or default}`; ignores registry.
 * 3. {@link REWARDS_PROGRAM_PUBLIC_BASE_URL_REGISTRY} for `(networkId, poolId, contractId)` + provider host.
 */
export const getRewardsProgramPublicBaseUrl = (
  networkId: NetworkId | string | null | undefined,
  poolId: string | number | null | undefined,
  contractId: string | number | null | undefined,
  token?: TokenRewardsUrlFields | null
): string | null => {
  const rawUrl = token?.rewardsPublicBaseUrl;
  if (rawUrl != null && String(rawUrl).trim() !== "") {
    return normalizeRewardsPublicBaseUrl(rawUrl);
  }
  const rawInstance = token?.rewardsInstanceId;
  if (rawInstance != null && String(rawInstance).trim() !== "") {
    const origin = resolveRewardsRegistryEntryToOrigin(String(rawInstance).trim());
    return origin !== "" ? origin : null;
  }
  if (
    networkId == null ||
    networkId === "" ||
    poolId == null ||
    contractId == null
  ) {
    return null;
  }
  const key = `${String(networkId).toLowerCase()}:${String(poolId)}:${String(contractId)}`;
  const fromRegistry = REWARDS_PROGRAM_PUBLIC_BASE_URL_REGISTRY[key];
  if (fromRegistry) {
    const origin = resolveRewardsRegistryEntryToOrigin(fromRegistry);
    return origin !== "" ? origin : null;
  }
  return null;
};

/**
 * Get market label (A, B, etc.) for a given network and poolId
 * @param networkId - The network ID (e.g., "voi-mainnet", "algorand-mainnet")
 * @param poolId - The pool ID
 * @returns The market label (A, B, etc.) or null if not found
 */
export const getMarketLabel = (
  networkId: NetworkId | string | null | undefined,
  poolId: string | null | undefined
): string | null => {
  if (!networkId || !poolId) {
    return null;
  }

  // Normalize networkId to handle variations
  const normalizedNetworkId = String(networkId).toLowerCase();
  const normalizedPoolId = String(poolId);

  // Try direct lookup
  const key = `${normalizedNetworkId}-${normalizedPoolId}`;
  if (marketLabelMap[key]) {
    return marketLabelMap[key];
  }

  // Fallback: try to get from network config
  try {
    const networkConfig = getNetworkConfig(normalizedNetworkId as NetworkId);
    const lendingPools = networkConfig?.contracts?.lendingPools || [];
    if (lendingPools.length >= 2) {
      if (String(poolId) === String(lendingPools[0])) return "A";
      if (String(poolId) === String(lendingPools[1])) return "B";
    }
  } catch (e) {
    // Network not found in config, return null
  }

  return null;
};

/**
 * Pool id when the row object has not yet populated `marketInfo` / `poolId` (same rules as markets table `getPoolIdForSorting`).
 */
export const getPoolIdFromTokenConfig = (
  networkId: NetworkId,
  asset: string,
  marketIndex?: number
): string | null => {
  try {
    const networkConfig = getNetworkConfig(networkId);
    const tokenConfigRaw = networkConfig.tokens[asset];
    if (Array.isArray(tokenConfigRaw)) {
      if (marketIndex !== undefined && tokenConfigRaw[marketIndex]?.poolId != null) {
        return String(tokenConfigRaw[marketIndex].poolId);
      }
      if (tokenConfigRaw.length > 0 && tokenConfigRaw[0]?.poolId != null) {
        return String(tokenConfigRaw[0].poolId);
      }
    } else if (tokenConfigRaw?.poolId != null) {
      return String(tokenConfigRaw.poolId);
    }
  } catch {
    // ignore
  }
  return null;
};

/**
 * Borrow APY tooltip lists utilization; for A-market WAD that line is hidden to reduce confusion (dorkfi-app#266).
 * Pass `market` / `marketIndex` so pool id resolves from token config when the row has no carousel (single market, no pool on row yet).
 */
export const shouldHideBorrowTooltipUtilizationForWad = (
  networkId: NetworkId | string | null | undefined,
  asset: string | null | undefined,
  poolId: string | null | undefined,
  market?: { marketInfo?: { poolId?: string }; poolId?: string },
  marketIndex?: number
): boolean => {
  if (!asset || asset !== "WAD") return false;
  if (!networkId) return false;
  const nid = networkId as NetworkId;
  const resolved =
    poolId ??
    market?.marketInfo?.poolId ??
    market?.poolId ??
    getPoolIdFromTokenConfig(nid, asset, marketIndex) ??
    null;
  return getMarketLabel(networkId, resolved) === "A";
};

/**
 * Helper functions for accessing configuration
 */
export const getNetworkConfig = (networkId: NetworkId): NetworkConfig => {
  return config.networks[networkId];
};

/** Short product labels for UI where `NetworkConfig.name` is too verbose (e.g. modal network row). */
const NETWORK_DISPLAY_NAME_OVERRIDES: Partial<Record<NetworkId, string>> = {
  "voi-mainnet": "Voi Network",
  "algorand-mainnet": "Algorand",
};

/**
 * User-facing network title for UI. Uses branded short names for Voi / Algorand mainnet,
 * otherwise `NetworkConfig.name`, then a readable slug if unknown.
 */
export const getNetworkDisplayName = (networkId: string): string => {
  const id = networkId as NetworkId;
  const branded = NETWORK_DISPLAY_NAME_OVERRIDES[id];
  if (branded) return branded;
  const entry = config.networks[id];
  if (entry?.name) return entry.name;
  return networkId.replace(/-/g, " ");
};

export const getCurrentNetworkConfig = (): NetworkConfig => {
  return config.networks[config.defaultNetwork];
};

/**
 * Update the current network
 * This function updates the defaultNetwork in the config
 */
export const setCurrentNetwork = (networkId: NetworkId): void => {
  if (!config.networks[networkId]) {
    throw new Error(`Network ${networkId} is not configured`);
  }
  config.defaultNetwork = networkId;
};

export const getWalletNetworkId = (networkId: NetworkId): string => {
  return config.networks[networkId].walletNetworkId;
};

export const getCurrentWalletNetworkId = (): string => {
  return config.networks[config.defaultNetwork].walletNetworkId;
};

export const getRpcPort = (networkId: NetworkId): number | undefined => {
  return config.networks[networkId].rpcPort;
};

export const getRpcToken = (networkId: NetworkId): string | undefined => {
  return config.networks[networkId].rpcToken;
};

export const getRpcPublicUrl = (networkId: NetworkId): string | undefined => {
  return config.networks[networkId].rpcPublicUrl;
};

export const getCurrentRpcPort = (): number | undefined => {
  return getRpcPort(config.defaultNetwork);
};

export const getCurrentRpcToken = (): string | undefined => {
  return getRpcToken(config.defaultNetwork);
};

export const getCurrentRpcPublicUrl = (): string | undefined => {
  return getRpcPublicUrl(config.defaultNetwork);
};

export const getRpcConfig = (networkId: NetworkId) => {
  const networkConfig = config.networks[networkId];
  return {
    url: networkConfig.rpcUrl,
    publicUrl: networkConfig.rpcPublicUrl,
    port: networkConfig.rpcPort,
    token: networkConfig.rpcToken,
  };
};

export const getCurrentRpcConfig = () => {
  return getRpcConfig(config.defaultNetwork);
};

export const getEnabledNetworks = (): NetworkId[] => {
  return config.enabledNetworks;
};

/**
 * Get network IDs that have governance contracts configured (for Governance page)
 */
export const getNetworksWithGovernance = (): NetworkId[] => {
  return config.enabledNetworks.filter((networkId) => {
    const governance = config.networks[networkId].contracts.governance;
    return governance !== undefined && governance !== null;
  });
};

export const isMigrationEnabled = (): boolean => {
  return getConfig().features.enableMigration;
};

export const getEnabledNetworkConfigs = (): NetworkConfig[] => {
  return config.enabledNetworks.map((networkId) => config.networks[networkId]);
};

export const isNetworkEnabled = (networkId: NetworkId): boolean => {
  return config.enabledNetworks.includes(networkId);
};

export const getContractAddress = (
  networkId: NetworkId,
  contractName: keyof ContractConfig
): string | string[] | GovernanceConfig | undefined => {
  return config.networks[networkId].contracts[contractName];
};

/**
 * Get all lending pools for a specific network
 */
export const getLendingPools = (networkId: NetworkId): string[] => {
  return config.networks[networkId].contracts.lendingPools;
};

/**
 * Get the first lending pool for a specific network (for backward compatibility)
 */
export const getLendingPool = (networkId: NetworkId): string | undefined => {
  const pools = getLendingPools(networkId);
  return pools.length > 0 ? pools[0] : undefined;
};

/**
 * Get lending pools for the current network
 */
export const getCurrentLendingPools = (): string[] => {
  return getLendingPools(config.defaultNetwork);
};

/**
 * Get the first lending pool for the current network (for backward compatibility)
 */
export const getCurrentLendingPool = (): string | undefined => {
  return getLendingPool(config.defaultNetwork);
};

export const getTokenConfig = (
  networkId: NetworkId,
  symbol: string
): TokenConfig | TokenConfig[] | undefined => {
  return config.networks[networkId].tokens[symbol];
};

/**
 * Map key for {@link getTokenConfig} from a {@link getAllTokensWithDisplayInfo} row.
 * Prefer `originalSymbol` (`fiUSDC`, `fUSDC`) over `configKey` (`USDC` for every `tokens.USDC[]` entry).
 */
export function tokenConfigLookupKeyFromDisplayToken(token: {
  configKey?: string;
  originalSymbol?: string;
  symbol: string;
}): string {
  const orig = String(token.originalSymbol ?? "").trim();
  if (orig !== "") return orig;
  const ck = String(token.configKey ?? "").trim();
  if (ck !== "") return ck;
  return String(token.symbol ?? "").trim();
}

/**
 * Full `TokenConfig` for a display token row when the map entry is an array (disambiguate by pool + market contract).
 */
export function resolveTokenConfigFromDisplayToken(
  networkId: NetworkId,
  token: {
    configKey?: string;
    originalSymbol?: string;
    symbol: string;
    poolId?: string | null;
    underlyingContractId?: string;
  }
): TokenConfig | undefined {
  const key = tokenConfigLookupKeyFromDisplayToken(token);
  const raw = getTokenConfig(networkId, key);
  if (!raw) return undefined;
  if (!Array.isArray(raw)) return raw;
  const poolStr = token.poolId != null ? String(token.poolId).trim() : "";
  const contractStr = String(token.underlyingContractId ?? "").trim();
  const poolOk = (tc: TokenConfig) =>
    poolStr === "" || String(tc.poolId ?? "") === poolStr;
  if (contractStr !== "") {
    const hit = raw.find(
      (tc) =>
        poolOk(tc) && String(tc.contractId ?? "").trim() === contractStr
    );
    if (hit) return hit;
  }
  return raw.find(poolOk) ?? raw[0];
}

/**
 * Single `TokenConfig` row for `symbol` + optional `poolId`, or any row matching `poolId` when
 * `getTokenConfig(symbol)` misses (e.g. fALGO row stored under `tokens.ALGO[]`).
 */
function resolveTokenConfigRowWithPool(
  networkId: NetworkId,
  symbol: string,
  poolId: string | undefined
): TokenConfig | undefined {
  const raw = getTokenConfig(networkId, symbol);
  if (raw) {
    return Array.isArray(raw)
      ? poolId != null && poolId !== ""
        ? raw.find((c) => String(c.poolId) === String(poolId)) ?? raw[0]
        : raw[0]
      : raw;
  }
  if (poolId == null || poolId === "") return undefined;
  const book = config.networks[networkId].tokens;
  for (const val of Object.values(book)) {
    if (Array.isArray(val)) {
      const hit = val.find((c) => String(c.poolId) === String(poolId));
      if (hit) return hit;
    } else if (val && String(val.poolId) === String(poolId)) {
      return val;
    }
  }
  return undefined;
}

/** Intrinsic supply APY (% points) from config when set; 0 if unset or not applicable. */
export const getIntrinsicSupplyApyPercent = (
  networkId: NetworkId | string | undefined,
  symbol: string,
  poolId: string | undefined
): number => {
  if (!networkId) return 0;
  const row = resolveTokenConfigRowWithPool(
    networkId as NetworkId,
    symbol,
    poolId
  );
  if (!row) return 0;
  const v = row.intrinsicApyPercent;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

/** Optional live intrinsic supply APY values (percentage points) for {@link resolveIntrinsicSupplyApyPercent}. */
export type LiveIntrinsicSupplyApySnapshot = {
  tinymanLiquidStakingPercent?: number | null;
  xalgoGovernanceLambdaPercent?: number | null;
  /** Folks mainnet ALGO lending pool deposit APY (fALGO), percentage points. */
  folksMainnetAlgoDepositPercent?: number | null;
  /** Folks mainnet USDC lending pool deposit APY (fUSDC supply yield), percentage points. */
  folksMainnetUsdcDepositPercent?: number | null;
  /** Folks mainnet USDC pool variable borrow yield, percentage points. */
  folksMainnetUsdcBorrowPercent?: number | null;
  /** Folks Algorand Ecosystem USDC pool (fiUSDC) deposit yield, percentage points. */
  folksMainnetFiUsdcEcosystemDepositPercent?: number | null;
  /** Folks Algorand Ecosystem USDC pool variable borrow yield, percentage points. */
  folksMainnetFiUsdcEcosystemBorrowPercent?: number | null;
};

/**
 * Intrinsic supply APY (% points) for display: on Algorand mainnet, prefers a live rate when
 * {@link TokenConfig.intrinsicApyLiveSource} is set and the matching snapshot field is valid;
 * otherwise {@link getIntrinsicSupplyApyPercent}.
 */
export const resolveIntrinsicSupplyApyPercent = (
  networkId: NetworkId | string | undefined,
  symbol: string,
  poolId: string | undefined,
  live?: LiveIntrinsicSupplyApySnapshot | null
): number => {
  const base = getIntrinsicSupplyApyPercent(networkId, symbol, poolId);
  if (networkId !== "algorand-mainnet") return base;
  const row = resolveTokenConfigRowWithPool(
    networkId as NetworkId,
    symbol,
    poolId
  );
  const source = row?.intrinsicApyLiveSource;
  if (source === "tinyman_liquid_staking") {
    const v = live?.tinymanLiquidStakingPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  if (source === "xalgo_governance_lambda") {
    const v = live?.xalgoGovernanceLambdaPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  if (source === "folks_mainnet_algo_pool_deposit") {
    const v = live?.folksMainnetAlgoDepositPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  if (source === "folks_mainnet_usdc_pool_deposit") {
    const v = live?.folksMainnetUsdcDepositPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  if (source === "folks_mainnet_fiusdc_ecosystem_pool_deposit") {
    const v = live?.folksMainnetFiUsdcEcosystemDepositPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  return base;
};

/** Whether this listing uses any configured live intrinsic supply APY source on Algorand mainnet. */
export const tokenRowUsesLiveIntrinsicApy = (
  networkId: NetworkId | string | undefined,
  symbol: string,
  poolId: string | undefined
): boolean => {
  if (networkId !== "algorand-mainnet") return false;
  const row = resolveTokenConfigRowWithPool(
    networkId as NetworkId,
    symbol,
    poolId
  );
  const s = row?.intrinsicApyLiveSource;
  return (
    s === "tinyman_liquid_staking" ||
    s === "xalgo_governance_lambda" ||
    s === "folks_mainnet_algo_pool_deposit" ||
    s === "folks_mainnet_usdc_pool_deposit" ||
    s === "folks_mainnet_fiusdc_ecosystem_pool_deposit"
  );
};

/** Whether this listing uses any configured live intrinsic borrow APY source on Algorand mainnet. */
export const tokenRowUsesLiveIntrinsicBorrowApy = (
  networkId: NetworkId | string | undefined,
  symbol: string,
  poolId: string | undefined
): boolean => {
  if (networkId !== "algorand-mainnet") return false;
  const row = resolveTokenConfigRowWithPool(
    networkId as NetworkId,
    symbol,
    poolId
  );
  const s = row?.intrinsicBorrowApyLiveSource;
  return (
    s === "tinyman_liquid_staking" ||
    s === "xalgo_governance_lambda" ||
    s === "folks_mainnet_algo_pool_deposit" ||
    s === "folks_mainnet_usdc_pool_borrow" ||
    s === "folks_mainnet_fiusdc_ecosystem_pool_borrow"
  );
};

/** Intrinsic borrow APY (% points) from config when set; 0 if unset or not applicable. */
export const getIntrinsicBorrowApyPercent = (
  networkId: NetworkId | string | undefined,
  symbol: string,
  poolId: string | undefined
): number => {
  if (!networkId) return 0;
  const row = resolveTokenConfigRowWithPool(
    networkId as NetworkId,
    symbol,
    poolId
  );
  if (!row) return 0;
  const v = row.intrinsicBorrowApyPercent;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

/**
 * Intrinsic borrow APY (% points) for display: on Algorand mainnet, prefers a live rate when
 * {@link TokenConfig.intrinsicBorrowApyLiveSource} is set and the matching snapshot field is valid;
 * otherwise {@link getIntrinsicBorrowApyPercent}.
 */
export const resolveIntrinsicBorrowApyPercent = (
  networkId: NetworkId | string | undefined,
  symbol: string,
  poolId: string | undefined,
  live?: LiveIntrinsicSupplyApySnapshot | null
): number => {
  const base = getIntrinsicBorrowApyPercent(networkId, symbol, poolId);
  if (networkId !== "algorand-mainnet") return base;
  const row = resolveTokenConfigRowWithPool(
    networkId as NetworkId,
    symbol,
    poolId
  );
  const source = row?.intrinsicBorrowApyLiveSource;
  if (source === "tinyman_liquid_staking") {
    const v = live?.tinymanLiquidStakingPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  if (source === "xalgo_governance_lambda") {
    const v = live?.xalgoGovernanceLambdaPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  if (source === "folks_mainnet_algo_pool_deposit") {
    const v = live?.folksMainnetAlgoDepositPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  if (source === "folks_mainnet_usdc_pool_borrow") {
    const v = live?.folksMainnetUsdcBorrowPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  if (source === "folks_mainnet_fiusdc_ecosystem_pool_borrow") {
    const v = live?.folksMainnetFiUsdcEcosystemBorrowPercent;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    return base;
  }
  return base;
};

export const getAllTokens = (networkId: NetworkId): TokenConfig[] => {
  const tokens = config.networks[networkId].tokens;
  const result: TokenConfig[] = [];
  for (const tokenConfig of Object.values(tokens)) {
    if (Array.isArray(tokenConfig)) {
      result.push(...tokenConfig);
    } else {
      result.push(tokenConfig);
    }
  }
  return result;
};

/**
 * Get token display information with market override support
 * This function returns the display name and symbol, considering market overrides
 * For tokens with multiple markets (array), returns info for the first market
 */
export const getTokenDisplayInfo = (
  networkId: NetworkId,
  symbol: string,
  marketIndex: number = 0
) => {
  const tokenConfig = getTokenConfig(networkId, symbol);
  if (!tokenConfig) {
    return null;
  }

  // Handle array of token configs (multiple markets)
  const config: TokenConfig = Array.isArray(tokenConfig)
    ? tokenConfig[marketIndex] ?? tokenConfig[0]
    : tokenConfig;

  if (!config) {
    return null;
  }

  // If market override is configured, use the override values
  if (config.marketOverride) {
    return {
      name: config.marketOverride.displayName,
      symbol: config.marketOverride.displaySymbol,
      underlyingAssetId:
        config.marketOverride.underlyingAssetId || config.assetId,
      underlyingContractId:
        config.marketOverride.underlyingContractId || config.contractId,
      isSmartContract: config.marketOverride.isSmartContract,
      originalName: config.name,
      originalSymbol: config.symbol,
      originalContractId: config.contractId,
      poolId: config.poolId, // Include pool ID from config
    };
  }

  // Otherwise, return the original token information
  return {
    name: config.name,
    symbol: config.symbol,
    underlyingAssetId: config.assetId,
    underlyingContractId: config.contractId,
    isSmartContract: false,
    originalName: config.name,
    originalSymbol: config.symbol,
    originalContractId: config.contractId,
    poolId: config.poolId, // Include pool ID from config
  };
};

/**
 * Get all tokens with display information (considering market overrides)
 * For tokens with multiple markets, each market is returned as a separate entry
 */
export const getAllTokensWithDisplayInfo = (networkId: NetworkId) => {
  const tokens = config.networks[networkId].tokens;
  const result: Array<{
    /** Config `tokens` object key (e.g. `fALGO`); stable when `symbol` is display-only. */
    configKey: string;
    symbol: string;
    name: string;
    underlyingAssetId?: string;
    underlyingContractId?: string;
    isSmartContract: boolean;
    originalName: string;
    originalSymbol: string;
    originalContractId?: string;
    poolId?: string;
    decimals: number;
    logoPath: string;
    isNew: boolean;
  }> = [];

  for (const [symbol, tokenConfig] of Object.entries(tokens)) {
    if (Array.isArray(tokenConfig)) {
      // Handle multiple markets for the same token
      tokenConfig.forEach((config, index) => {
        const displayInfo = getTokenDisplayInfo(networkId, symbol, index);
        if (displayInfo) {
          result.push({
            symbol,
            ...displayInfo,
            decimals: config.decimals,
            logoPath: config.logoPath,
            isNew: isNewMarketByDataAddedAt(config.dataAddedAt),
            configKey: symbol,
          });
        }
      });
    } else {
      // Handle single token config (backwards compatible)
      const displayInfo = getTokenDisplayInfo(networkId, symbol);
      if (displayInfo) {
        result.push({
          symbol,
          ...displayInfo,
          decimals: tokenConfig.decimals,
          logoPath: tokenConfig.logoPath,
          isNew: isNewMarketByDataAddedAt(tokenConfig.dataAddedAt),
          configKey: symbol,
        });
      }
    }
  }

  return result;
};

/**
 * Check if a token has market override configured
 * For tokens with multiple markets, checks the first market
 */
export const hasMarketOverride = (
  networkId: NetworkId,
  symbol: string
): boolean => {
  const tokenConfig = getTokenConfig(networkId, symbol);
  if (!tokenConfig) {
    return false;
  }
  const config: TokenConfig = Array.isArray(tokenConfig)
    ? tokenConfig[0]
    : tokenConfig;
  return config?.marketOverride !== undefined;
};

/**
 * Get the underlying asset ID for a token (considering market overrides)
 * For tokens with multiple markets, returns the asset ID for the first market
 */
export const getUnderlyingAssetId = (
  networkId: NetworkId,
  symbol: string,
  marketIndex: number = 0
): string | undefined => {
  const displayInfo = getTokenDisplayInfo(networkId, symbol, marketIndex);
  return displayInfo?.underlyingAssetId;
};

/**
 * Get the underlying contract ID for a token (considering market overrides)
 * For tokens with multiple markets, returns the contract ID for the first market
 */
export const getUnderlyingContractId = (
  networkId: NetworkId,
  symbol: string,
  marketIndex: number = 0
): string | undefined => {
  const displayInfo = getTokenDisplayInfo(networkId, symbol, marketIndex);
  return displayInfo?.underlyingContractId;
};

/**
 * Get PreFi parameters for a network
 */
export const getPreFiParameters = (
  networkId: NetworkId
): PreFiParameters | undefined => {
  const network = getNetworkConfig(networkId);
  return network?.preFiParameters;
};

export const isFeatureEnabled = (
  feature: keyof GlobalConfig["features"]
): boolean => {
  return config.features[feature];
};

/**
 * Network type helper functions
 */
export const getNetworkType = (networkId: NetworkId): NetworkType => {
  return config.networks[networkId].networkType;
};

export const isAVMNetwork = (networkId: NetworkId): boolean => {
  return getNetworkType(networkId) === "avm";
};

export const isEVMNetwork = (networkId: NetworkId): boolean => {
  return getNetworkType(networkId) === "evm";
};

export const getCurrentNetworkType = (): NetworkType => {
  return getCurrentNetworkConfig().networkType;
};

export const isCurrentNetworkAVM = (): boolean => {
  return getCurrentNetworkType() === "avm";
};

export const isCurrentNetworkEVM = (): boolean => {
  return getCurrentNetworkType() === "evm";
};

export const isCurrentNetworkVOI = (): boolean => {
  const networkId = getCurrentNetworkConfig().networkId;
  return networkId === "voi-mainnet";
};

export const isCurrentNetworkAlgorand = (): boolean => {
  const networkId = getCurrentNetworkConfig().networkId;
  return networkId === "algorand-mainnet" || networkId === "algorand-testnet";
};

/**
 * Get all networks of a specific type
 */
export const getNetworksByType = (
  networkType: NetworkType
): NetworkConfig[] => {
  return Object.values(config.networks).filter(
    (network) => network.networkType === networkType
  );
};

export const getAVMNetworks = (): NetworkConfig[] => {
  return getNetworksByType("avm");
};

export const getEVMNetworks = (): NetworkConfig[] => {
  return getNetworksByType("evm");
};

/**
 * Environment-specific overrides
 */
export const getEnvironmentConfig = (): Partial<GlobalConfig> => {
  const env = process.env.NODE_ENV;

  // Check for environment variable overrides
  const envFeatures: Partial<GlobalConfig["features"]> = {};

  // Check VITE_ENABLE_LIQUIDATABLE_POSITIONS environment variable
  if (typeof import.meta.env.VITE_ENABLE_LIQUIDATABLE_POSITIONS !== "undefined") {
    envFeatures.enableLiquidatablePositions =
      import.meta.env.VITE_ENABLE_LIQUIDATABLE_POSITIONS === "true" ||
      import.meta.env.VITE_ENABLE_LIQUIDATABLE_POSITIONS === "1";
  }

  if (env === "development") {
    return {
      defaultNetwork: "voi-mainnet",
      features: {
        ...config.features,
        enableGovernance: true, // Enable governance in development for testing
        ...envFeatures,
      },
    };
  }

  if (env === "test") {
    return {
      defaultNetwork: "voi-mainnet",
      features: {
        ...config.features,
        enablePreFi: false, // Disable PreFi in tests
        enableMigration: true, // Keep migration enabled in tests
        ...envFeatures,
      },
    };
  }

  return Object.keys(envFeatures).length > 0
    ? ({ features: envFeatures } as Partial<GlobalConfig>)
    : {};
};

/**
 * Merge environment config with base config
 */
export const getConfig = (): GlobalConfig => {
  const envConfig = getEnvironmentConfig();
  return {
    ...config,
    ...envConfig,
    features: {
      ...config.features,
      ...(envConfig.features || {}),
    },
  };
};

/**
 * Algorand Service Integration
 * Helper functions to convert between network config and Algorand service format
 */
export const getAlgorandNetworkFromNetworkId = (
  networkId: NetworkId
): "mainnet" | "testnet" | "local" | "voimain" | null => {
  switch (networkId) {
    case "algorand-mainnet":
      return "mainnet";
    case "algorand-testnet":
      return "testnet";
    case "voi-mainnet":
      return "voimain";
    case "localnet":
      return "local";
    default:
      return null;
  }
};

export const getAlgorandConfigFromNetworkConfig = (
  networkConfig: NetworkConfig,
  usePublicUrl: boolean = true
) => {
  const algorandNetwork = getAlgorandNetworkFromNetworkId(
    networkConfig.networkId
  );
  if (!algorandNetwork) {
    throw new Error(
      `Network ${networkConfig.networkId} is not an Algorand-compatible network`
    );
  }

  // Use public URL if available and requested, otherwise fall back to regular RPC URL
  const rpcUrl =
    usePublicUrl && networkConfig.rpcPublicUrl
      ? networkConfig.rpcPublicUrl
      : networkConfig.rpcUrl;
  const indexerUrl = networkConfig.indexerUrl;

  // Parse server from URL (remove protocol)
  const algodServer = rpcUrl.replace(/^https?:\/\//, "").split(":")[0];
  const indexerServer = indexerUrl.replace(/^https?:\/\//, "").split(":")[0];

  // Use configured port or derive from URL
  const algodPort =
    networkConfig.rpcPort ?? (rpcUrl.includes("https") ? 443 : 80);
  const indexerPort = networkConfig.indexerUrl.includes("https") ? 443 : 80;

  return {
    network: algorandNetwork,
    algodToken: networkConfig.rpcToken ?? "", // Use configured token or empty string
    algodServer: rpcUrl, // Use full URL instead of just hostname
    algodPort,
    indexerToken: "", // Indexer tokens not currently configured
    indexerServer: indexerUrl, // Use full URL instead of just hostname
    indexerPort,
  };
};

export const isAlgorandCompatibleNetwork = (networkId: NetworkId): boolean => {
  return getAlgorandNetworkFromNetworkId(networkId) !== null;
};

export const isCurrentNetworkAlgorandCompatible = (): boolean => {
  return isAlgorandCompatibleNetwork(config.defaultNetwork);
};

/**
 * Get Algorand configuration for the current network
 */
export const getCurrentAlgorandConfig = (usePublicUrl: boolean = true) => {
  const currentConfig = getCurrentNetworkConfig();
  return getAlgorandConfigFromNetworkConfig(currentConfig, usePublicUrl);
};

/**
 * Get Algorand configuration optimized for transaction sending (uses regular RPC URL)
 */
export const getAlgorandConfigForTransactions = (networkId: NetworkId) => {
  const networkConfig = getNetworkConfig(networkId);
  return getAlgorandConfigFromNetworkConfig(networkConfig, false);
};

/**
 * Get Algorand configuration optimized for read operations (uses public RPC URL when available)
 */
export const getAlgorandConfigForReads = (networkId: NetworkId) => {
  const networkConfig = getNetworkConfig(networkId);
  return getAlgorandConfigFromNetworkConfig(networkConfig, true);
};

/**
 * Get current Algorand configuration optimized for transaction sending
 */
export const getCurrentAlgorandConfigForTransactions = () => {
  return getAlgorandConfigForTransactions(config.defaultNetwork);
};

/**
 * Get current Algorand configuration optimized for read operations
 */
export const getCurrentAlgorandConfigForReads = () => {
  return getAlgorandConfigForReads(config.defaultNetwork);
};

/**
 * Get faucet URL for a specific network
 */
export const getFaucetUrl = (networkId: NetworkId): string | undefined => {
  return config.networks[networkId].faucetUrl;
};

/**
 * Get faucet URL for the current network
 */
export const getCurrentFaucetUrl = (): string | undefined => {
  return getFaucetUrl(config.defaultNetwork);
};

/**
 * Get gas station symbols for a specific network
 */
export const getGasStationSymbols = (networkId: NetworkId): string[] => {
  return config.networks[networkId].gasStation || [];
};

/**
 * Get gas station symbols for the current network
 */
export const getCurrentGasStationSymbols = (): string[] => {
  return getGasStationSymbols(config.defaultNetwork);
};

/**
 * Check if a token symbol is available in the gas station for a specific network
 */
export const isGasStationToken = (
  networkId: NetworkId,
  symbol: string
): boolean => {
  return getGasStationSymbols(networkId).includes(symbol);
};

/**
 * Check if a token symbol is available in the gas station for the current network
 */
export const isCurrentGasStationToken = (symbol: string): boolean => {
  return isGasStationToken(config.defaultNetwork, symbol);
};

/**
 * Initialize Algorand clients for the current network
 * This function bridges the gap between our network config and Algorand service
 */
export const initializeAlgorandForCurrentNetwork = async (
  usePublicUrl: boolean = true
) => {
  const algorandConfig = getCurrentAlgorandConfig(usePublicUrl);

  // Import AlgorandService functions dynamically to avoid circular dependencies
  const { initializeClients } = await import("@/services/algorandService");

  return initializeClients(algorandConfig.network, algorandConfig);
};

export default config;
