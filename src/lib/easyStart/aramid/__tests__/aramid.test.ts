import { describe, expect, it } from "vitest";
import { toFunctionSelector } from "viem";
import {
  aramidSendForDestination,
  splitAramidFee,
  usdcToAtomic,
} from "@/lib/easyStart/aramid/fees";
import { encodeAramidLockTokens } from "@/lib/easyStart/aramid/lockTokens";
import { encodeAramidReleaseTokens } from "@/lib/easyStart/aramid/releaseTokens";
import { parseAramidClaimNote } from "@/lib/easyStart/aramid/claimData";
import { encodeAramidAvmToBaseNote } from "@/lib/easyStart/aramid/note";
import { ARAMID_AVM_BRIDGE, ARAMID_CLAIM_DATA_PREFIX, ARAMID_NOTE_PREFIX, aramidClaimUrl } from "@/lib/easyStart/aramid/constants";
import {
  ARAMID_AVM_DUMMY_BEACON_APP,
  ARAMID_AVM_DUMMY_NOP_SELECTOR,
  aramidAvmToBaseArccjsExtraTxn,
  findAramidAxferTxId,
} from "@/lib/easyStart/aramid/avmToBaseExtraTxn";
import algosdk from "algosdk";

describe("splitAramidFee", () => {
  it("truncates destination as floor(total / 1.001)", () => {
    const total = 100_000_000n;
    const { feeAmount, destinationAmount } = splitAramidFee(total);
    expect(destinationAmount).toBe((total * 1000n) / 1001n);
    expect(feeAmount + destinationAmount).toBe(total);
  });

  it("parses human USDC amounts", () => {
    expect(usdcToAtomic("100")).toBe(100_000_000n);
    expect(usdcToAtomic("1.5")).toBe(1_500_000n);
  });

  it("inverts the fee so destination is at least the requested credit", () => {
    const need = 37_258_500n;
    const send = aramidSendForDestination(need);
    expect(splitAramidFee(send).destinationAmount).toBeGreaterThanOrEqual(need);
  });
});

describe("encodeAramidLockTokens", () => {
  it("uses the live lockTokens selector", () => {
    const data = encodeAramidLockTokens({
      feeAmount: 24456n,
      rootAmount: 24431138n,
      algorandAddress:
        "65Z4RSSNWO4N6BBF7FINJC2ZE6F7JBVCEFMKKMWZ3RZA7VTX4RXZWCLLVA",
    });
    expect(data.slice(0, 10)).toBe(
      toFunctionSelector(
        "lockTokens(address,uint256,address,uint256,(uint32,string,uint256,string),string)"
      )
    );
    expect(data.startsWith("0x07622459")).toBe(true);
  });
});

describe("parseAramidClaimNote", () => {
  const sourceTxId = "I2OYQGWGEQUWTWC6Q544A5VCZZWGA5UBRIGY4BCLUTS2N74EGDQQ";
  const note =
    ARAMID_CLAIM_DATA_PREFIX +
    JSON.stringify({
      sourceRound: 1,
      destinationRound: 2,
      maxClaimRound: 43200,
      sourceTransactionId: sourceTxId,
      sourceChainData: {
        chainId: 416001,
        tokenId: "31566704",
        amount: "999000",
        addressId: "65Z4RSSNWO4N6BBF7FINJC2ZE6F7JBVCEFMKKMWZ3RZA7VTX4RXZWCLLVA",
      },
      destinationChainData: {
        chainId: 8453,
        tokenId: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        amount: "999000",
        addressId: "0x42E0793E4F029557D4C16a05Ae0D989A173eC6aA",
      },
      note: "aramid",
      signatures: ["0x" + "11".repeat(65), "0x" + "22".repeat(65)],
    });

  it("parses soldier claim data for the matching source tx", () => {
    const claim = parseAramidClaimNote(note, sourceTxId);
    expect(claim?.maxClaimRound).toBe(43200);
    expect(claim?.destinationChainData.chainId).toBe(8453);
    expect(claim?.signatures).toHaveLength(2);
  });

  it("ignores a different source tx", () => {
    expect(parseAramidClaimNote(note, "AAAA")).toBeNull();
  });
});

describe("encodeAramidReleaseTokens", () => {
  it("uses the live releaseTokens selector", () => {
    const claim = parseAramidClaimNote(
      `${ARAMID_CLAIM_DATA_PREFIX}${JSON.stringify({
        maxClaimRound: 43200,
        sourceTransactionId: "I2OYQGWGEQUWTWC6Q544A5VCZZWGA5UBRIGY4BCLUTS2N74EGDQQ",
        sourceChainData: {
          chainId: 416001,
          tokenId: "31566704",
          amount: "999000",
          addressId: "65Z4RSSNWO4N6BBF7FINJC2ZE6F7JBVCEFMKKMWZ3RZA7VTX4RXZWCLLVA",
        },
        destinationChainData: {
          chainId: 8453,
          tokenId: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          amount: "999000",
          addressId: "0x42E0793E4F029557D4C16a05Ae0D989A173eC6aA",
        },
        note: "aramid",
        signatures: ["0x" + "11".repeat(65)],
      })}`,
      "I2OYQGWGEQUWTWC6Q544A5VCZZWGA5UBRIGY4BCLUTS2N74EGDQQ"
    );
    expect(claim).not.toBeNull();
    const data = encodeAramidReleaseTokens(claim!);
    expect(data.slice(0, 10)).toBe(
      toFunctionSelector(
        "releaseTokens(uint64,string,(uint32,string,uint256,string),(uint32,address,uint256,address),string,bytes[])"
      )
    );
  });
});

describe("encodeAramidAvmToBaseNote", () => {
  it("prefixes JSON with aramid-transfer/v1", () => {
    const bytes = encodeAramidAvmToBaseNote({
      evmAddress: "0x42E0793E4F029557D4C16a05Ae0D989A173eC6aA",
      feeAmount: 50000n,
      destinationAmount: 49950000n,
    });
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith(ARAMID_NOTE_PREFIX)).toBe(true);
    const json = JSON.parse(text.slice(ARAMID_NOTE_PREFIX.length));
    expect(json.destinationNetwork).toBe(8453);
    expect(json.destinationToken.toLowerCase()).toBe(
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
    );
    expect(json.feeAmount).toBe("50000");
    expect(json.sourceAmount).toBe("49950000");
    expect(json.destinationAmount).toBe("49950000");
    expect(typeof json.feeAmount).toBe("string");
  });
});

describe("aramidClaimUrl", () => {
  it("appends the full Algorand txid", () => {
    expect(
      aramidClaimUrl("I2OYQGWGEQUWTWC6Q544A5VCZZWGA5ABCDEFGHIJKLMNOPQRSTUV")
    ).toMatch(/\/I2OYQGWGEQUWTWC6Q544A5VCZZWGA5ABCDEFGHIJKLMNOPQRSTUV$/);
  });
});

describe("aramidAvmToBaseArccjsExtraTxn", () => {
  it("emits a standalone axfer extraTxn to the Aramid AVM bridge", () => {
    const user =
      "65Z4RSSNWO4N6BBF7FINJC2ZE6F7JBVCEFMKKMWZ3RZA7VTX4RXZWCLLVA";
    const row = aramidAvmToBaseArccjsExtraTxn({
      userAddress: user,
      sendAtomic: 8_000_000n,
      evmAddress: "0x42E0793E4F029557D4C16a05Ae0D989A173eC6aA",
      feeAmount: 7992n,
      destinationAmount: 7_992_008n,
    });
    expect(row.ignore).toBe(true);
    expect(row.appIndex).toBe(ARAMID_AVM_DUMMY_BEACON_APP);
    expect(row.appArgs).toEqual([ARAMID_AVM_DUMMY_NOP_SELECTOR]);
    expect(row.snd).toBe(user);
    expect(row.arcv).toBe(ARAMID_AVM_BRIDGE);
    expect(row.xaid).toBe(31566704);
    expect(row.xamt).toBe(8_000_000);
    const note = new TextDecoder().decode(row.xano as Uint8Array);
    expect(note.startsWith(ARAMID_NOTE_PREFIX)).toBe(true);
    const json = JSON.parse(note.slice(ARAMID_NOTE_PREFIX.length));
    expect(typeof json.sourceAmount).toBe("string");
    expect(typeof json.feeAmount).toBe("string");
  });

  it("finds the Aramid axfer txid in an unsigned group", () => {
    const genesisHash = Uint8Array.from(
      atob("wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="),
      (c) => c.charCodeAt(0)
    );
    const suggestedParams = {
      fee: 1000,
      minFee: 1000,
      firstValid: 1,
      lastValid: 1001,
      genesisID: "mainnet-v1.0",
      genesisHash,
      flatFee: true,
    };
    const user =
      "65Z4RSSNWO4N6BBF7FINJC2ZE6F7JBVCEFMKKMWZ3RZA7VTX4RXZWCLLVA";
    const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: user,
      receiver: ARAMID_AVM_BRIDGE,
      amount: 8_000_000,
      assetIndex: 31566704,
      suggestedParams,
    });
    const decoy = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: user,
      receiver: user,
      amount: 0,
      suggestedParams,
    });
    const b64 = (txn: algosdk.Transaction) =>
      Buffer.from(txn.toByte()).toString("base64");
    expect(findAramidAxferTxId([b64(decoy), b64(axfer)])).toBe(axfer.txID());
  });
});
