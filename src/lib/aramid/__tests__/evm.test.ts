import { describe, expect, it } from "vitest";
import { encodeLockTokens } from "@/lib/aramid/evm";

describe("encodeLockTokens", () => {
  it("uses the Base bridge lockTokens selector", () => {
    const data = encodeLockTokens({
      token: "0xb40C776253c4BbC18A9e635aCC183359e5fa22f9",
      feeAmount: 11988n,
      rootAmount: 11976012n,
      destination: {
        chainId: 416001,
        tokenId: "2320775407",
        amount: 11976012n,
        addressId: "65Z4RSSNWO4N6BBF7FINJC2ZE6F7JBVCEFMKKMWZ3RZA7VTX4RXZWCLLVA",
      },
      note: "aramid",
    });
    expect(data.startsWith("0x07622459")).toBe(true);
    expect(data.includes("32333230373735343037".toLowerCase()) || data.includes("32333230373735343037")).toBe(true);
  });
});
