import registryData from "@/data/dorkNftAlgorandRegistry.json";

/** DEVOUR — custodial inbox for Dork NFT bridge transfers (same address on Voi and Algorand). */
export const DORK_NFT_BRIDGE_ADDRESS =
  "IDVOVR7DORKO42D5GNBXLA73QNSQ6VVSCKJHGDBZOVVKTPQWXPTCUUYMEI";

/** DORKHJ — Algorand reserve that holds bridged Dork ASAs for outbound Voi → Algorand releases. */
export const DORK_NFT_ALGORAND_RESERVE_ADDRESS = registryData.reserve as string;

export const NFT_BRIDGE_NOTE_PREFIX = "dorkfi-bridge:v1:";

export type NftBridgeDirection = "voi-to-algorand" | "algorand-to-voi";

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
