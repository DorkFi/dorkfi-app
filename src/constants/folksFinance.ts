/**
 * Folks Finance mainnet contract references from the official docs (Pools + ecosystem + core apps).
 * @see https://docs.folks.finance/developer/contracts
 *
 * Update this file when Folks publishes new app / pool ids; do not scatter magic strings in token config.
 */

export interface FolksFinancePoolParams {
  /** Pool name as in Folks docs (e.g. ALGO, gALGO, `WBTC (old)`). */
  pool: string;
  appId: string;
  /** Underlying ASA id, or `"-"` for native ALGO. */
  assetId: string;
  fAssetId: string;
  frAssetId: string;
  appAddress: string;
}

/** Top-level Folks apps on Algorand mainnet (docs “Contracts” intro tables). */
export const FOLKS_FINANCE_ALGORAND_MAINNET_APPS = {
  poolManagerAppId: "971350278",
  depositAppId: "971353536",
  depositsStakingAppId: "1093729103",
} as const;

/**
 * Folks “Pools” table — main Algorand deployment.
 * Keys match the `Pool` column in the docs (including spaces / parentheses).
 */
export const FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY: Record<
  string,
  FolksFinancePoolParams
> = {
  ALGO: {
    pool: "ALGO",
    appId: "971368268",
    assetId: "-",
    fAssetId: "971381860",
    frAssetId: "971381861",
    appAddress:
      "2ZPNLKXWCOUJ2ONYWZEIWOUYRXL36VCIBGJ4ZJ2AAGET5SIRTHKSNFDJJ4",
  },
  gALGO: {
    pool: "gALGO",
    appId: "971370097",
    assetId: "793124631",
    fAssetId: "971383839",
    frAssetId: "971383840",
    appAddress:
      "YVIEGXMJYLVJPVHDU4W6VPKRLVTNR66FLFV54AGJ3KXTAW4FIDJOYUMCXM",
  },
  xALGO: {
    pool: "xALGO",
    appId: "2611131944",
    assetId: "1134696561",
    fAssetId: "2611138444",
    frAssetId: "2611138445",
    appAddress:
      "YO4ZOK3AEX4YDMOBIYLQUYHO75YPCIOD24PR6KIAVHUW5TZ4OCPSXV6BQE",
  },
  tALGO: {
    pool: "tALGO",
    appId: "3073474613",
    assetId: "2537013734",
    fAssetId: "3073480070",
    frAssetId: "3073480071",
    appAddress:
      "DNENHJOFOPOCKW3H3VJXXCPCXYDOW5HMWCHOGVPLY7JQFLGH5KSE7IXVDI",
  },
  USDC: {
    pool: "USDC",
    appId: "971372237",
    assetId: "31566704",
    fAssetId: "971384592",
    frAssetId: "971384593",
    appAddress:
      "MIHR7TQMMH2J6Q7PFQQEP7AAPVWPGNMPDKI2WDYDTM5P3RNKPD6X4UXG6E",
  },
  USDt: {
    pool: "USDt",
    appId: "971372700",
    assetId: "312769",
    fAssetId: "971385312",
    frAssetId: "971385313",
    appAddress:
      "HONE5UB5XL2AKARPJ2FBJMEQ3KD2JRNZQ4MTVXWIWTIC6JDNE6QW2TXVKU",
  },
  EURS: {
    pool: "EURS",
    appId: "1247053569",
    assetId: "227855942",
    fAssetId: "1247054501",
    frAssetId: "1247054502",
    appAddress:
      "P4B56R5KSYUL6KG5KY5LJQHRWYNQIGVCUM2AVUVERCOGDTCW77QHY7ALWU",
  },
  Gard: {
    pool: "Gard",
    appId: "1060585819",
    assetId: "684649988",
    fAssetId: "1060587336",
    frAssetId: "1060587337",
    appAddress:
      "RDOPB7VY2JLIQRZGZFLZXH2ZL4BJMYXNVH5DCKGQOZ3PDISHEWD4YHFIUY",
  },
  goBTC: {
    pool: "goBTC",
    appId: "971373361",
    assetId: "386192725",
    fAssetId: "971386173",
    frAssetId: "971386174",
    appAddress:
      "TO56M4DLPYEHBWGFOTG55EE7CNQCJ7RYZECTWY4G7XG6LGHGPXCV4CI7MM",
  },
  goETH: {
    pool: "goETH",
    appId: "971373611",
    assetId: "386195940",
    fAssetId: "971387073",
    frAssetId: "971387074",
    appAddress:
      "3DSRBNSMEK7RR7M7SWRIK5QWGITNM7ZFUJOPPGWM3NPOPO4EQRHRSUXHL4",
  },
  "WBTC (old)": {
    pool: "WBTC (old)",
    appId: "1067289273",
    assetId: "1058926737",
    fAssetId: "1067295154",
    frAssetId: "1067295155",
    appAddress:
      "BV3EU3GIX26XJBF6AX5OC2HJJ5F2OJNQC7M3Y6DGQKPVURPRCHXBEE2OJM",
  },
  "WETH (old)": {
    pool: "WETH (old)",
    appId: "1067289481",
    assetId: "887406851",
    fAssetId: "1067295558",
    frAssetId: "1067295559",
    appAddress:
      "EHC6W75UHDUB5AHFIKMRDV7LEF77GCMONME5QLNRJWOJB7NGPYZBTT556Q",
  },
  WBTC: {
    pool: "WBTC",
    appId: "3514794123",
    assetId: "3495558025",
    fAssetId: "3514808410",
    frAssetId: "3514808411",
    appAddress:
      "VAXIU6QCBZ6OP7D7OPDRSSVKEY7G3QOEBHKKSWCRNHRM6LTLL6Y37KGUOM",
  },
  WETH: {
    pool: "WETH",
    appId: "3514795114",
    assetId: "3495722210",
    fAssetId: "3514808788",
    frAssetId: "3514808789",
    appAddress:
      "ZOLYUQQM6KKR4UJH3CJDIOH2IMMKF5AMU36WMFBBHLIUTZ3LGUUG25DWTY",
  },
  WAVAX: {
    pool: "WAVAX",
    appId: "1166977433",
    assetId: "893309613",
    fAssetId: "1166979636",
    frAssetId: "1166979637",
    appAddress:
      "7A5PQOCMKDSUV63TUTOX3BMSJK44HH3UCT3YATBF33J6O4IRE7NLEWZ6AI",
  },
  WSOL: {
    pool: "WSOL",
    appId: "1166980669",
    assetId: "887648583",
    fAssetId: "1166980820",
    frAssetId: "1166980821",
    appAddress:
      "XYW235QHOM46UQN4XIL5CRUZLCYVUYHIOJN77D6ELREPLORTRXM2ZSBKUI",
  },
  WLINK: {
    pool: "WLINK",
    appId: "1216434571",
    assetId: "1200094857",
    fAssetId: "1216437148",
    frAssetId: "1216437149",
    appAddress:
      "S5OOT4RBI3ICPLZFPDTJGLWOJPK3CSX4SRCRQ7FUU3RAY5DVNUXJ3MH7NE",
  },
  GOLD: {
    pool: "GOLD",
    appId: "1258515734",
    assetId: "246516580",
    fAssetId: "1258524377",
    frAssetId: "1258524378",
    appAddress:
      "FXSTEOMHRWW6N5K3KF3UU2I2QABPKRVV2NRIO5WMRCG46AHIW6YWKRJI7Y",
  },
  SILVER: {
    pool: "SILVER",
    appId: "1258524099",
    assetId: "246519683",
    fAssetId: "1258524381",
    frAssetId: "1258524382",
    appAddress:
      "JK4OF7KFXTH4FPXM7WJP2QR7PS5OCTO64SPCSDQCVRS3OZXPCCE5ZAVKP4",
  },
  OPUL: {
    pool: "OPUL",
    appId: "1044267181",
    assetId: "287867876",
    fAssetId: "1044269355",
    frAssetId: "1044269356",
    appAddress:
      "VMRS35QRC5UVI5ZLGEDWFJX3464EBFRLD72NNJ2P34IWICCRBOG3YB2JX4",
  },
  WMPL: {
    pool: "WMPL",
    appId: "1166982094",
    assetId: "1163259470",
    fAssetId: "1166982296",
    frAssetId: "1166982297",
    appAddress:
      "G7DYFK6XGZEWCEMEQPTC6SYIVEIZPFXFGOKRIXO523JQZHYFD7IHM3YLIQ",
  },
};

/**
 * Folks “Algorand Ecosystem” pools (separate app ids from the main Pools table).
 * @see https://docs.folks.finance/developer/contracts
 */
export const FOLKS_FINANCE_ALGORAND_ECOSYSTEM_POOLS_BY_KEY: Record<
  string,
  FolksFinancePoolParams
> = {
  ALGO: {
    pool: "ALGO",
    appId: "3184317016",
    assetId: "-",
    fAssetId: "3184331013",
    frAssetId: "3184331014",
    appAddress:
      "AP3RK6OGPQLQ2V4ZKTNFENSOHKIYQ3ZVSSPCUVCOM2LXANDCCCQRQWWRFE",
  },
  USDC: {
    pool: "USDC",
    appId: "3184324594",
    assetId: "31566704",
    fAssetId: "3184331239",
    frAssetId: "3184331240",
    appAddress:
      "266UR6IXNJ5SKC33R2QSLIFL743SA4O6EX3TJZUSB6CFKMFQYH4SAJIMSE",
  },
  TINY: {
    pool: "TINY",
    appId: "3184325123",
    assetId: "2200000000",
    fAssetId: "3184331789",
    frAssetId: "3184331790",
    appAddress:
      "ZC5CBMO3GBGXOXK6T2PXOZPYBD63LNOMZLC23LFTIWDRR3QWPZQN7UJMY4",
  },
  FOLKS: {
    pool: "FOLKS",
    appId: "3343137163",
    assetId: "3203964481",
    fAssetId: "3343139268",
    frAssetId: "3343139269",
    appAddress:
      "VN3QMQYRO7V6NQJYRKV5QFIP4IATCI4IBQ46QBOLWZ23255JJE4SMTGLOE",
  },
};

/**
 * Stable `FolksFinancePoolParams.pool` / Folks SDK lookup key for the Algorand Ecosystem USDC
 * deposit app (fiUSDC f-ASA). Distinct from mainnet `"USDC"` so {@link MainnetPools} resolution
 * stays unambiguous in `folksDepositAdapter`.
 */
export const FOLKS_ALGORAND_ECOSYSTEM_USDC_SDK_POOL_NAME =
  "USDC_ALGORAND_ECOSYSTEM" as const;

/** Adapter + SDK mint/withdraw params for fiUSDC (same chain ids as `USDC` in ecosystem table). */
export const FOLKS_FINANCE_FIUSDC_ADAPTER_POOL_PARAMS: FolksFinancePoolParams = {
  ...FOLKS_FINANCE_ALGORAND_ECOSYSTEM_POOLS_BY_KEY.USDC,
  pool: FOLKS_ALGORAND_ECOSYSTEM_USDC_SDK_POOL_NAME,
};

/**
 * Adapter + SDK mint/withdraw params for fiTINY (same app/asset ids as `TINY` in ecosystem table).
 * `pool` is the Folks SDK mainnet key `ISOLATED_TINY` (not the docs display name `"TINY"`).
 */
export const FOLKS_FINANCE_FITINY_ADAPTER_POOL_PARAMS: FolksFinancePoolParams = {
  ...FOLKS_FINANCE_ALGORAND_ECOSYSTEM_POOLS_BY_KEY.TINY,
  pool: "ISOLATED_TINY",
};

/**
 * Adapter + SDK mint/withdraw params for Folks V2 WBTC (NTT). `pool` is the Folks SDK mainnet key
 * `WBTC_NTT` (not legacy `WBTC` / `WBTC (old)`).
 */
export const FOLKS_FINANCE_WBTC_ADAPTER_POOL_PARAMS: FolksFinancePoolParams = {
  ...FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY.WBTC,
  pool: "WBTC_NTT",
};

/** Resolve a mainnet pool row by `Pool` name from the docs (e.g. `ALGO`, `WBTC (old)`). */
export function lookupFolksAlgorandMainnetPool(
  pool: string
): FolksFinancePoolParams | undefined {
  return FOLKS_FINANCE_ALGORAND_MAINNET_POOLS_BY_KEY[pool];
}

/** Resolve an “Algorand Ecosystem” pool row (distinct app ids from the main pool table). */
export function lookupFolksAlgorandEcosystemPool(
  pool: string
): FolksFinancePoolParams | undefined {
  return FOLKS_FINANCE_ALGORAND_ECOSYSTEM_POOLS_BY_KEY[pool];
}
