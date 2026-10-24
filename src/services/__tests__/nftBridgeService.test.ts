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
  bridgeSubmitOutcomeError,
  encodeLegacyBridgeDestinationNote,
  normalizeBridgeAddressInput,
  formatBridgeFeeCurrencyError,
  formatBridgeReceiveLine,
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

describe("normalizeBridgeAddressInput", () => {
  it("removes all whitespace from pasted addresses", () => {
    expect(
      normalizeBridgeAddressInput(
        "EM6YOBT4UOMEGWZO74OLOSA55V6EH6DUQSCAJA6FNMQ5IS5U3GZXBUR2OI "
      )
    ).toBe("EM6YOBT4UOMEGWZO74OLOSA55V6EH6DUQSCAJA6FNMQ5IS5U3GZXBUR2OI");
  });
});

describe("encodeLegacyBridgeDestinationNote", () => {
  it("accepts a 58-char mainnet address as raw note bytes", () => {
    const addr =
      "IDVOVR7DORKO42D5GNBXLA73QNSQ6VVSCKJHGDBZOVVKTPQWXPTCUUYMEI";
    const note = encodeLegacyBridgeDestinationNote(addr);
    expect(note).not.toBeNull();
    expect(new TextDecoder().decode(note!)).toBe(addr);
    expect(note!.length).toBe(58);
  });

  it("rejects invalid addresses", () => {
    expect(encodeLegacyBridgeDestinationNote("not-an-address")).toBeNull();
  });
});

describe("bridgeSubmitOutcomeError", () => {
  it("returns null when all groups succeed", () => {
    expect(
      bridgeSubmitOutcomeError({
        failedGroupIndices: [],
        successfulTxIds: ["tx1"],
        totalGroups: 1,
        feeCurrency: "ALGO",
        custodyLabel: "DEVOUR",
      })
    ).toBeNull();
  });

  it("maps insufficient ALGO balance copy to VOI for Voi-network fees", () => {
    const msg = bridgeSubmitOutcomeError({
      failedGroupIndices: [0],
      successfulTxIds: [],
      totalGroups: 1,
      firstGroupError:
        "transaction 123: account ABC balance 1000000 below min 5000000 (0 assets)",
      feeCurrency: "VOI",
      custodyLabel: "DEVOUR",
    });
    expect(msg).toMatch(/VOI/);
    expect(formatBridgeFeeCurrencyError("Need more ALGO for fees", "VOI")).toBe(
      "Need more VOI for fees"
    );
  });
});

describe("formatBridgeReceiveLine", () => {
  const entry = {
    name: "DORK 1",
    assetId: 3600686574,
    collectionName: "Dorks v1",
    voiTokenId: 1,
  };

  it("shows ASA id on Algorand destination", () => {
    expect(formatBridgeReceiveLine(entry, "voi-to-algorand")).toBe(
      "DORK 1 → ASA 3600686574"
    );
  });

  it("shows collection and item number on Voi destination", () => {
    expect(formatBridgeReceiveLine(entry, "algorand-to-voi")).toBe(
      "DORK 1 → Dorks v1 #1"
    );
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
    expect(enriched[0]?.receiveLine).toBe("DORK 1 → ASA 3600686574");
    expect(enriched[0]?.sourceId).toBe("arc72:313597:1");
  });

  it("maps Algorand ASAs to Voi collection and token id", () => {
    const enriched = enrichNftsForBridge(
      [
        {
          contractId: 313597,
          tokenId: "1",
          name: "DORK 1",
          imageUrl: "",
        },
      ],
      "algorand-to-voi"
    );
    expect(enriched[0]?.receiveLine).toBe("DORK 1 → Dorks v1 #1");
    expect(enriched[0]?.destAssetId).toBe("313597:1");
  });
});
