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
 * deploy another UnitLpPowerSource, then owner `add_power_source(appId, 10000, 1)`
 * and set `appId` here plus `powerSources` in config.
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
