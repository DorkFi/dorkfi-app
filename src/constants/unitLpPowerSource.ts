import {
  CURATED_LIQUIDITY_POOLS,
  type LiquidityPoolPairConfig,
} from "@/constants/liquidityPools";

/** Algorand UNIT ASA. Keep in sync with `UNIT_ASA_ID` in liquidityPools when present. */
export const UNIT_ASA_ID = 3121954282;

/** Tinyman V2 validator app on Algorand mainnet (pool local state lives here). */
export const TINYMAN_V2_VALIDATOR_APP_ID = 1002541853;

/** Same scale as live UNIT nToken source 3333783429 (`get_power_source`: 10000, 1). */
export const UNIT_LP_POWER_MULTIPLIER = 10000;
export const UNIT_LP_POWER_SUPPORTED_MODES = 1;

/**
 * Live UNIT nToken power source (Pool A). Already registered on-chain.
 * Admin Add Power Source may keep this on the allowlist; it is not a converter.
 */
export const UNIT_NTOKEN_POWER_SOURCE_ID = 3333783429;

/**
 * LP nt200 market apps for the three UNIT Tinyman pairs (1:1 LP, not UNIT share).
 * Never pass these to `add_power_source`.
 *
 * - unit-algo (UNIT/ALGO): 3577729953, pool 5T5VBTBOPW2ZRJX6QJYCBMZ24VAW7IWFGV7GHCBKFNKIN2XYHP5OLOSQJQ
 * - unit-gobtc (UNIT/goBTC): 3577777819, pool YQJ7QB4AWGA6XDHABFI5JXSDQUMM4JVG7EG4FXT4WQXUKVA44BGSSN2BZA
 * - wad-unit (WAD/UNIT): 3577783311, pool 77FCRUX5B4AKC3SQ4KB6SP6SIXUQFU3QYYTZSJWMOSDJO3AO4E6P4Z6EXE
 */
export const FORBIDDEN_LP_NTOKEN_POWER_SOURCE_IDS = [
  3577729953, 3577777819, 3577783311,
] as const;

/**
 * End state (Admin Add Power Source + UNIT_LP_POWER_ADAPTERS):
 * 1. Shelly deploys the three UnitLpPowerSource apps.
 * 2. Fill each converter appId into UNIT_LP_POWER_ADAPTERS and
 *    algorandProdGovernance.powerSources.
 * 3. Owner runs add_power_source(appId, 10000, 1) for each via Admin.
 * 4. Admin only allows 3333783429 (existing UNIT nToken source) plus converter
 *    appIds set on UNIT_LP_POWER_ADAPTERS. No free-typed app ids.
 * 5. Never register the three LP nt200 ids as power sources.
 */

/**
 * Converter app ids once deployed. Empty `appId` means the adapter is not live;
 * vote() will not snap it. Do not register LP nToken ids here — those are 1:1 LP.
 */
export type UnitLpPowerAdapter = {
  pairId: string;
  appId?: number;
};

/**
 * UNIT-containing Tinyman pairs that should back vote power.
 * To add another UNIT LP: append `{ pairId }` (must exist in CURATED_LIQUIDITY_POOLS),
 * deploy another UnitLpPowerSource, set `appId` here plus `powerSources` in config,
 * then owner `add_power_source(appId, 10000, 1)` from the Admin dropdown.
 */
export const UNIT_LP_POWER_ADAPTERS: UnitLpPowerAdapter[] = [
  { pairId: "unit-algo" },
  { pairId: "unit-gobtc" },
  { pairId: "wad-unit" },
];

export type DeployedUnitLpPowerAdapter = UnitLpPowerAdapter & {
  appId: number;
  pair: LiquidityPoolPairConfig;
};

export function deployedUnitLpPowerAdapters(): DeployedUnitLpPowerAdapter[] {
  const out: DeployedUnitLpPowerAdapter[] = [];
  for (const adapter of UNIT_LP_POWER_ADAPTERS) {
    if (typeof adapter.appId !== "number") continue;
    const pair = CURATED_LIQUIDITY_POOLS.find((p) => p.id === adapter.pairId);
    if (!pair?.poolAddr) continue;
    out.push({ ...adapter, appId: adapter.appId, pair });
  }
  return out;
}

export function isForbiddenLpNtokenPowerSourceId(appId: number): boolean {
  return (FORBIDDEN_LP_NTOKEN_POWER_SOURCE_IDS as readonly number[]).includes(
    appId
  );
}

/** Converter app ids filled into {@link UNIT_LP_POWER_ADAPTERS}. */
export function converterPowerSourceAppIds(): number[] {
  return UNIT_LP_POWER_ADAPTERS.map((adapter) => adapter.appId).filter(
    (id): id is number => typeof id === "number" && id > 0
  );
}

/**
 * Admin Add Power Source allowlist: live UNIT nToken plus filled converter apps.
 * Until converters have appIds, this path must not accept arbitrary ids.
 */
export function allowlistedAddPowerSourceAppIds(): number[] {
  const ids = [
    UNIT_NTOKEN_POWER_SOURCE_ID,
    ...converterPowerSourceAppIds(),
  ].filter((id) => !isForbiddenLpNtokenPowerSourceId(id));
  return [...new Set(ids)];
}

export function addPowerSourceOptionLabel(appId: number): string {
  if (appId === UNIT_NTOKEN_POWER_SOURCE_ID) {
    return `UNIT nToken (${appId})`;
  }
  const adapter = UNIT_LP_POWER_ADAPTERS.find((a) => a.appId === appId);
  return adapter ? `${adapter.pairId} converter (${appId})` : String(appId);
}

/**
 * Frontend/service guard only — does not change on-chain governance.
 * Rejects LP nt200 ids and anything not on the allowlist. Requires at least one
 * converter appId on UNIT_LP_POWER_ADAPTERS before this Admin path can register.
 */
export function assertRegisterablePowerSourceAppId(appId: number): void {
  if (!Number.isFinite(appId) || appId <= 0) {
    throw new Error("Enter a valid app id");
  }
  if (isForbiddenLpNtokenPowerSourceId(appId)) {
    throw new Error(
      `App ${appId} is an LP nt200 market (1:1 LP), not a UNIT share converter. Never register it as a power source.`
    );
  }
  const converters = converterPowerSourceAppIds();
  if (converters.length === 0) {
    throw new Error(
      "UNIT_LP_POWER_ADAPTERS converter appIds are not set. Shelly deploys UnitLpPowerSource, then fill each appId before Add Power Source."
    );
  }
  if (!allowlistedAddPowerSourceAppIds().includes(appId)) {
    throw new Error(
      `App ${appId} is not allowlisted. Admin only allows ${UNIT_NTOKEN_POWER_SOURCE_ID} (UNIT nToken) plus converter appIds on UNIT_LP_POWER_ADAPTERS.`
    );
  }
}

/** Args for `UnitLpPowerSource.create` (one deploy per UNIT pair). */
export function unitLpPowerCreateArgs(pair: LiquidityPoolPairConfig): {
  ntokenAppId: number;
  poolAddress: string;
  unitAssetId: number;
  validatorAppId: number;
} {
  if (!pair.poolAddr) {
    throw new Error(`Pair ${pair.id} is missing poolAddr`);
  }
  return {
    ntokenAppId: pair.lpContractId,
    poolAddress: pair.poolAddr,
    unitAssetId: UNIT_ASA_ID,
    validatorAppId: TINYMAN_V2_VALIDATOR_APP_ID,
  };
}

/** Minimal ABI for ulujs builder calls to a deployed converter. */
export const UNIT_LP_POWER_SOURCE_SPEC = {
  name: "UnitLpPowerSource",
  desc: "Converts deposited UNIT LP to UNIT-denominated voting power",
  methods: [
    {
      name: "sync",
      args: [],
      returns: { type: "uint256" },
    },
    {
      name: "arc200_balanceOf",
      args: [{ name: "user", type: "address" }],
      returns: { type: "uint256" },
    },
  ],
  events: [],
};
