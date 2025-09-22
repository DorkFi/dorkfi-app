/**
 * Global Configuration for DorkFi Protocol
 *
 * This file contains network-specific configurations, contract addresses,
 * and other global settings used throughout the application.
 */

export type NetworkId =
  | "voi-mainnet"
  | "voi-testnet"
  | "algorand-mainnet"
  | "algorand-testnet"
  | "base-mainnet"
  | "base-testnet"
  | "ethereum-mainnet"
  | "ethereum-testnet"
  | "localnet";

export type NetworkType = "avm" | "evm";

export interface ContractConfig {
  lendingPools: string[];
  priceOracle?: string;
  liquidationEngine?: string;
  governance?: string;
  treasury?: string;
  // Add more contracts as needed
}

export type TokenStandard = "network" | "asa" | "arc200";

export interface TokenConfig {
  assetId?: string;
  contractId?: string; // Contract address or application ID for smart contract tokens
  poolId?: string; // Lending pool ID for this token
  nTokenId?: string; // nToken ID for deposits in lending protocol
  decimals: number;
  name: string;
  symbol: string;
  logoPath: string;
  tokenStandard: TokenStandard; // Token standard: network, asa, or arc200
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

export interface NetworkConfig {
  networkId: NetworkId;
  walletNetworkId: string;
  name: string;
  networkType: NetworkType;
  rpcUrl: string;
  rpcPublicUrl?: string;
  rpcPort?: number;
  rpcToken?: string;
  indexerUrl: string;
  explorerUrl: string;
  contracts: ContractConfig;
  tokens: {
    [symbol: string]: TokenConfig;
  };
  preFiParameters?: PreFiParameters;
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
  };
}

/**
 * VOI Mainnet Configuration
 */
const voiMainnetConfig: NetworkConfig = {
  networkId: "voi-mainnet",
  walletNetworkId: "voimain",
  name: "VOI Mainnet",
  networkType: "avm",
  rpcUrl: "https://mainnet-api.voi.nodely.dev",
  rpcPort: 443,
  rpcToken: "",
  indexerUrl: "https://mainnet-idx.voi.nodely.dev",
  explorerUrl: "https://voi.observer",
  contracts: {
    lendingPools: ["41760711", "44866061"],
    // Add other contract IDs as they become available
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
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
    // Fountain VOI 770561 6
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
    // NODE 410811 6
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
    // BUIDL 419744 6
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
    // SHELLY 410111 8
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
    // AMMO 798968 6
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
    // GM 300279 2
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
    // CORN 412682 6
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
    // F 302222 6
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
    // IAT 420024 6
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
  },
  preFiParameters: {
    collateral_factor: 780, // 78% = 780 bp
    liquidation_threshold: 825, // 82.5% = 825 bp
    reserve_factor: 100, // 10% = 100 bp
    borrow_rate_base: 50, // 5% = 50 bp
    slope: 100, // 10% = 100 bp
    liquidation_bonus: 50, // 5% = 50 bp
    close_factor: 350, // 35% = 350 bp
    max_borrow_caps: {
      stablecoins: "100000",
      majors: "50000",
      volatile: "10000",
    },
  },
};

/**
 * VOI Testnet Configuration
 */
const voiTestnetConfig: NetworkConfig = {
  networkId: "voi-testnet",
  walletNetworkId: "voitest",
  name: "VOI Testnet",
  networkType: "avm",
  rpcUrl: "https://testnet-idx.voi.nodely.dev",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://testnet-idx.voi.nodely.dev",
  explorerUrl: "https://testnet.voi.observer",
  contracts: {
    lendingPools: ["TESTNET_LENDING_POOL_ID"], // TODO: Replace with actual testnet contract ID
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
    VOI: {
      assetId: undefined, // Native token
      poolId: "41760711", // Same pool ID as mainnet for now
      decimals: 6,
      name: "VOI",
      symbol: "VOI",
      logoPath: "/lovable-uploads/VOI.png",
      tokenStandard: "network",
    },
    // Add testnet-specific tokens as needed
  },
};

/**
 * Algorand Mainnet Configuration (for reference)
 */
const algorandMainnetConfig: NetworkConfig = {
  networkId: "algorand-mainnet",
  walletNetworkId: "mainnet",
  name: "Algorand Mainnet",
  networkType: "avm",
  rpcUrl: "https://mainnet-api.4160.nodely.dev",
  rpcPublicUrl: "https://mainnet-api.algorand.nautilus.sh",
  rpcPort: 443,
  rpcToken: undefined, // Public endpoint, no token required
  indexerUrl: "https://mainnet-idx.4160.nodely.dev",
  explorerUrl: "https://algoexplorer.io",
  contracts: {
    lendingPools: ["3207735602", "3212536201"],
    priceOracle: undefined,
    liquidationEngine: undefined,
    governance: undefined,
    treasury: undefined,
  },
  tokens: {
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
      logoPath: "/lovable-uploads/USDC.png",
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
    // SCOUT 569120128 6 3220313750
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
    // GOLD$ 246516580 6 3220347315
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
  },
};

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
export const config: GlobalConfig = {
  networks: {
    "voi-mainnet": voiMainnetConfig,
    "voi-testnet": voiTestnetConfig,
    "algorand-mainnet": algorandMainnetConfig,
    "algorand-testnet": algorandTestnetConfig,
    "base-mainnet": baseMainnetConfig,
    "base-testnet": baseTestnetConfig,
    "ethereum-mainnet": ethereumMainnetConfig,
    "ethereum-testnet": ethereumTestnetConfig,
    localnet: localnetConfig,
  },
  defaultNetwork: "voi-mainnet",
  enabledNetworks: ["voi-mainnet", "algorand-mainnet"],
  version: "1.0.0",
  features: {
    enablePreFi: true,
    enableLiquidations: true,
    enableSwap: true,
    enableGovernance: false, // Disabled until governance contracts are deployed
    enableMigration: true, // Enable asset migration feature
  },
};

/**
 * Helper functions for accessing configuration
 */
export const getNetworkConfig = (networkId: NetworkId): NetworkConfig => {
  return config.networks[networkId];
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
): string | string[] | undefined => {
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

export const getTokenConfig = (networkId: NetworkId, symbol: string) => {
  return config.networks[networkId].tokens[symbol];
};

export const getAllTokens = (networkId: NetworkId) => {
  return Object.values(config.networks[networkId].tokens);
};

/**
 * Get token display information with market override support
 * This function returns the display name and symbol, considering market overrides
 */
export const getTokenDisplayInfo = (networkId: NetworkId, symbol: string) => {
  const tokenConfig = getTokenConfig(networkId, symbol);
  if (!tokenConfig) {
    return null;
  }

  // If market override is configured, use the override values
  if (tokenConfig.marketOverride) {
    return {
      name: tokenConfig.marketOverride.displayName,
      symbol: tokenConfig.marketOverride.displaySymbol,
      underlyingAssetId:
        tokenConfig.marketOverride.underlyingAssetId || tokenConfig.assetId,
      underlyingContractId:
        tokenConfig.marketOverride.underlyingContractId ||
        tokenConfig.contractId,
      isSmartContract: tokenConfig.marketOverride.isSmartContract,
      originalName: tokenConfig.name,
      originalSymbol: tokenConfig.symbol,
      originalContractId: tokenConfig.contractId,
      poolId: tokenConfig.poolId, // Include pool ID from config
    };
  }

  // Otherwise, return the original token information
  return {
    name: tokenConfig.name,
    symbol: tokenConfig.symbol,
    underlyingAssetId: tokenConfig.assetId,
    underlyingContractId: tokenConfig.contractId,
    isSmartContract: false,
    originalName: tokenConfig.name,
    originalSymbol: tokenConfig.symbol,
    originalContractId: tokenConfig.contractId,
    poolId: tokenConfig.poolId, // Include pool ID from config
  };
};

/**
 * Get all tokens with display information (considering market overrides)
 */
export const getAllTokensWithDisplayInfo = (networkId: NetworkId) => {
  const tokens = config.networks[networkId].tokens;
  return Object.entries(tokens).map(([symbol, tokenConfig]) => ({
    symbol,
    ...getTokenDisplayInfo(networkId, symbol)!,
    decimals: tokenConfig.decimals,
    logoPath: tokenConfig.logoPath,
  }));
};

/**
 * Check if a token has market override configured
 */
export const hasMarketOverride = (
  networkId: NetworkId,
  symbol: string
): boolean => {
  const tokenConfig = getTokenConfig(networkId, symbol);
  return tokenConfig?.marketOverride !== undefined;
};

/**
 * Get the underlying asset ID for a token (considering market overrides)
 */
export const getUnderlyingAssetId = (
  networkId: NetworkId,
  symbol: string
): string | undefined => {
  const displayInfo = getTokenDisplayInfo(networkId, symbol);
  return displayInfo?.underlyingAssetId;
};

/**
 * Get the underlying contract ID for a token (considering market overrides)
 */
export const getUnderlyingContractId = (
  networkId: NetworkId,
  symbol: string
): string | undefined => {
  const displayInfo = getTokenDisplayInfo(networkId, symbol);
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
  return networkId === "voi-mainnet" || networkId === "voi-testnet";
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

  if (env === "development") {
    return {
      defaultNetwork: "voi-testnet", // Use testnet in development
      features: {
        ...config.features,
        enableGovernance: true, // Enable governance in development for testing
      },
    };
  }

  if (env === "test") {
    return {
      defaultNetwork: "voi-testnet",
      features: {
        ...config.features,
        enablePreFi: false, // Disable PreFi in tests
        enableMigration: true, // Keep migration enabled in tests
      },
    };
  }

  return {}; // No overrides for production
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
      ...envConfig.features,
    },
  };
};

/**
 * Algorand Service Integration
 * Helper functions to convert between network config and Algorand service format
 */
export const getAlgorandNetworkFromNetworkId = (
  networkId: NetworkId
): "mainnet" | "testnet" | "local" | "voimain" | "voitest" | null => {
  switch (networkId) {
    case "algorand-mainnet":
      return "mainnet";
    case "algorand-testnet":
      return "testnet";
    case "voi-mainnet":
      return "voimain";
    case "voi-testnet":
      return "voitest";
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
  const rpcUrl = usePublicUrl && networkConfig.rpcPublicUrl 
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
 * Initialize Algorand clients for the current network
 * This function bridges the gap between our network config and Algorand service
 */
export const initializeAlgorandForCurrentNetwork = async (usePublicUrl: boolean = true) => {
  const algorandConfig = getCurrentAlgorandConfig(usePublicUrl);

  // Import AlgorandService functions dynamically to avoid circular dependencies
  const { initializeClients } = await import("@/services/algorandService");

  return initializeClients(algorandConfig.network, algorandConfig);
};

export default config;
