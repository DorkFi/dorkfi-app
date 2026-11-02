/**
 * Easy Start gas sponsor (Base ETH + Algorand ALGO).
 * Server-only env — never prefix these with VITE_.
 *
 * Keep in sync with DEFAULT_PRIVY_APP_ID in src/utils/privyOrigin.ts
 */
const DEFAULT_PRIVY_APP_ID = "cmrfehwv300ix0ci8uh0tnm8q";
const DEFAULT_ETH_RPC = "https://mainnet.base.org";
const DEFAULT_ALGOD_URL = "https://mainnet-api.4160.nodely.dev";

/** Same floor as src/lib/easyStart/baseBalances.ts `MIN_BASE_ETH_WEI`. */
export const MIN_BASE_ETH_WEI = 50_000_000_000_000n; // 0.00005 ETH
/** Same floor as src/lib/easyStart/baseBalances.ts `MIN_ALGORAND_ALGO_MICRO`. */
export const MIN_ALGORAND_ALGO_MICRO = 100_000n; // 0.1 ALGO

const DEFAULT_ETH_AMOUNT_WEI = 100_000_000_000_000n; // 0.0001 ETH
const DEFAULT_ALGO_MICRO = 1_000_000n; // 1 ALGO

export type SponsorEnv = {
  enabled: boolean;
  privyAppId: string;
  privyAppSecret?: string;
  ethPrivateKey?: `0x${string}`;
  ethAmountWei: bigint;
  ethRpc: string;
  algoMnemonic?: string;
  algoMicro: bigint;
  algodUrl: string;
};

export function parseBoolFlag(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function parsePositiveBigInt(
  raw: string | undefined,
  fallback: bigint
): bigint {
  const t = raw?.trim();
  if (!t || !/^\d+$/.test(t)) return fallback;
  try {
    const n = BigInt(t);
    return n > 0n ? n : fallback;
  } catch {
    return fallback;
  }
}

export function parseEthPrivateKey(
  raw: string | undefined
): `0x${string}` | undefined {
  const t = raw?.trim().toLowerCase();
  if (!t) return undefined;
  const hex = t.startsWith("0x") ? t : `0x${t}`;
  if (!/^0x[0-9a-f]{64}$/.test(hex)) return undefined;
  return hex as `0x${string}`;
}

export function parseAlgoMnemonic(raw: string | undefined): string | undefined {
  const t = raw?.trim().replace(/\s+/g, " ");
  if (!t) return undefined;
  const words = t.split(" ");
  if (words.length !== 25) return undefined;
  return t;
}

export function loadSponsorEnv(
  env: Record<string, string | undefined> = process.env
): SponsorEnv {
  return {
    enabled: parseBoolFlag(env.SPONSOR_ENABLED),
    privyAppId:
      env.PRIVY_APP_ID?.trim() ||
      env.VITE_PRIVY_APP_ID?.trim() ||
      DEFAULT_PRIVY_APP_ID,
    privyAppSecret: env.PRIVY_APP_SECRET?.trim() || undefined,
    ethPrivateKey: parseEthPrivateKey(env.SPONSOR_ETH_PRIVATE_KEY),
    ethAmountWei: parsePositiveBigInt(
      env.SPONSOR_ETH_AMOUNT_WEI,
      DEFAULT_ETH_AMOUNT_WEI
    ),
    ethRpc: env.SPONSOR_ETH_RPC?.trim() || DEFAULT_ETH_RPC,
    algoMnemonic: parseAlgoMnemonic(env.SPONSOR_ALGO_MNEMONIC),
    algoMicro: parsePositiveBigInt(
      env.SPONSOR_ALGO_MICRO,
      DEFAULT_ALGO_MICRO
    ),
    algodUrl: (env.SPONSOR_ALGOD_URL?.trim() || DEFAULT_ALGOD_URL).replace(
      /\/+$/,
      ""
    ),
  };
}

/** Keys present so the endpoint can actually send. */
export function isSponsorConfigured(env: SponsorEnv): boolean {
  return Boolean(
    env.privyAppSecret && env.ethPrivateKey && env.algoMnemonic
  );
}

export function isSponsorLive(env: SponsorEnv): boolean {
  return env.enabled && isSponsorConfigured(env);
}
