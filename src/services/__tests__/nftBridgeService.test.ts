import { describe, expect, it } from "vitest";
import {
  bridgeCustodyAddress,
  bridgeCustodyLabel,
  DORK_NFT_ALGORAND_RESERVE_ADDRESS,
  DORK_NFT_BRIDGE_ADDRESS,
} from "@/config/nftBridge";
import {
  encodeBridgeIntentNote,
  enrichNftsForBridge,
  parseBridgeIntentNote,
} from "@/services/nftBridgeService";

describe("nftBridgeService notes", () => {
  it("round-trips bridge intent JSON in txn notes", () => {
    const payload = {
      v: 1 as const,
      dir: "voi-to-algorand" as const,
      receiver: "RECEIVERADDRESSRECEIVERADDRESSRECEIVERADDRESS111111111",
      sender: "SENDERADDRESSSENDERADDRESSSENDERADDRESSSENDER1111111111",
      items: [
        {
          sourceId: "arc72:313597:1",
          destAssetId: "3600686574",
          name: "DORK 1",
        },
      ],
    };
    const note = encodeBridgeIntentNote(payload);
    const parsed = parseBridgeIntentNote(note);
    expect(parsed).toEqual(payload);
  });
});

describe("bridge custody addresses", () => {
  it("uses DEVOUR for Voi to Algorand", () => {
    expect(bridgeCustodyLabel("voi-to-algorand")).toBe("DEVOUR");
    expect(bridgeCustodyAddress("voi-to-algorand")).toBe(DORK_NFT_BRIDGE_ADDRESS);
  });

  it("uses DORKHJ for Algorand to Voi", () => {
    expect(bridgeCustodyLabel("algorand-to-voi")).toBe("DORKHJ");
    expect(bridgeCustodyAddress("algorand-to-voi")).toBe(DORK_NFT_ALGORAND_RESERVE_ADDRESS);
  });
});

describe("enrichNftsForBridge", () => {
  it("maps Voi NFTs to Algorand ASA ids", () => {
    const enriched = enrichNftsForBridge(
      [
        {
          contractId: 313597,
          tokenId: "1",
          name: "DORK 1",
          imageUrl: "https://example.com/1.webp",
        },
      ],
      "voi-to-algorand"
    );
    expect(enriched).toHaveLength(1);
    expect(enriched[0]?.destAssetId).toBe("3600686574");
    expect(enriched[0]?.sourceId).toBe("arc72:313597:1");
  });
});
