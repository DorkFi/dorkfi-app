import { describe, expect, it } from "vitest";
import { toFunctionSelector } from "viem";
import { splitAramidFee, usdcToAtomic } from "@/lib/easyStart/aramid/fees";
import { encodeAramidLockTokens } from "@/lib/easyStart/aramid/lockTokens";
import { encodeAramidAvmToBaseNote } from "@/lib/easyStart/aramid/note";
import { ARAMID_NOTE_PREFIX } from "@/lib/easyStart/aramid/constants";

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
    expect(json.sourceAmount).toBe(49950000);
  });
});
