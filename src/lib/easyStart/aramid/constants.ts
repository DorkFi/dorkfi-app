/** Aramid Bridge — Base ↔ Algorand native USDC. */

export const ARAMID_EVM_BRIDGE =
  "0xC7FAA8f8C6D9Dc05ABf3C5aa741a38F9A6d1C263" as const;

export const ARAMID_AVM_BRIDGE =
  "ARAMIDFJYV2TOFB5MRNZJIXBSAVZCVAUDAPFGKR5PNX4MTILGAZABBTXQQ";

/** Algorand mainnet chain id used in Aramid destination data. */
export const ARAMID_ALGORAND_CHAIN_ID = 416001;

/** Base mainnet chain id. */
export const ARAMID_BASE_CHAIN_ID = 8453;

export const ARAMID_ALGORAND_USDC_TOKEN_ID = "31566704";

export const ARAMID_NOTE = "aramid";

export const ARAMID_NOTE_PREFIX = "aramid-transfer/v1:j";

/** Circle USDC on Base (same as Easy Start `BASE_MAINNET_USDC`). */
export const ARAMID_BASE_USDC =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export const ARAMID_CLAIM_URL = "https://app.aramid.finance/claim";

export const ARAMID_POLL_MS = 5_000;
export const ARAMID_MAX_POLLS = 120; // ~10 minutes
