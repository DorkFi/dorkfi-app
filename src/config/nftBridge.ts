import registryData from "@/data/dorkNftAlgorandRegistry.json";

/** DEVOUR — custodial inbox for Dork NFT bridge transfers (same address on Voi and Algorand). */
export const DORK_NFT_BRIDGE_ADDRESS =
  "IDVOVR7DORKO42D5GNBXLA73QNSQ6VVSCKJHGDBZOVVKTPQWXPTCUUYMEI";

/**
 * DORKHJ — Algorand ASA creator / reserve wallet (opted in to all Dork ASAs).
 * Inbound Algorand → Voi bridges send ASAs here; outbound Voi → Algorand releases also use this wallet.
 */
export const DORK_NFT_ALGORAND_RESERVE_ADDRESS = registryData.reserve as string;

export const NFT_BRIDGE_NOTE_PREFIX = "dorkfi-bridge:v1:";

export type NftBridgeDirection = "voi-to-algorand" | "algorand-to-voi";

/** On-chain custody inbox for the source-chain leg of a bridge. */
export function bridgeCustodyAddress(direction: NftBridgeDirection): string {
  return direction === "algorand-to-voi"
    ? DORK_NFT_ALGORAND_RESERVE_ADDRESS
    : DORK_NFT_BRIDGE_ADDRESS;
}

/** Short operator-facing label for the custody wallet on the source chain. */
export function bridgeCustodyLabel(direction: NftBridgeDirection): "DEVOUR" | "DORKHJ" {
  return direction === "algorand-to-voi" ? "DORKHJ" : "DEVOUR";
}

/** User-facing label for what they receive on the destination chain. */
export function bridgeDestinationKind(
  direction: NftBridgeDirection
): "ASA" | "VSA" {
  return direction === "voi-to-algorand" ? "ASA" : "VSA";
}

/** Indexer accounts to scan for `dorkfi-bridge:v1:` registration notes. */
/** When true, bridge UI builds txs but skips wallet sign and on-chain submit (local testing). */
export function isNftBridgeDryRun(): boolean {
  const raw = import.meta.env.VITE_NFT_BRIDGE_DRY_RUN;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return import.meta.env.DEV;
}

export function bridgeRegistrationLogAddresses(networkId: "voi-mainnet" | "algorand-mainnet"): string[] {
  if (networkId === "voi-mainnet") {
    return [DORK_NFT_BRIDGE_ADDRESS];
  }
  return [DORK_NFT_BRIDGE_ADDRESS, DORK_NFT_ALGORAND_RESERVE_ADDRESS];
}

export type NftBridgeIntentItem = {
  /** Source id: `arc72:<contract>:<token>` on Voi, or Algorand ASA id as string when bridging from Algorand. */
  sourceId: string;
  /** Matching asset on the destination chain (Algorand ASA id, or Voi `contract:token`). */
  destAssetId: string;
  name: string;
};

/** Native unit for the 0-amount registration payment grouped with each bridge transfer. */
export function bridgeRegistrationCurrencyLabel(
  networkId: "voi-mainnet" | "algorand-mainnet"
): "VOI" | "ALGO" {
  return networkId === "voi-mainnet" ? "VOI" : "ALGO";
}

export type NftBridgeIntentPayload = {
  v: 1;
  dir: NftBridgeDirection;
  /** Wallet that should receive the NFT on the destination chain. */
  receiver: string;
  /** Sender wallet that initiated the bridge (for operator logs). */
  sender: string;
  items: NftBridgeIntentItem[];
};
