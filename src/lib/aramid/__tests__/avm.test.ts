import { describe, expect, it } from "vitest";
import { aramidTransferNote } from "@/lib/aramid/avm";

describe("aramidTransferNote", () => {
  it("writes amounts as JSON numbers in Aramid's field order", () => {
    const note = new TextDecoder().decode(
      aramidTransferNote({
        destinationNetwork: 416101,
        destinationAddress:
          "H7J2GGFLC4DN3NL3PURAVI6S6DBWFRGR2NF2EXJKCTPPWZXIWMCGFPEP3A",
        destinationToken: "302189",
        feeAmount: "1000",
        sourceAmount: "999000",
        destinationAmount: "999000",
        note: "dorkfi",
      })
    );
    expect(note).toBe(
      'aramid-transfer/v1:j{"destinationNetwork":416101,"destinationAddress":"H7J2GGFLC4DN3NL3PURAVI6S6DBWFRGR2NF2EXJKCTPPWZXIWMCGFPEP3A","destinationToken":"302189","feeAmount":1000,"destinationAmount":999000,"note":"dorkfi","sourceAmount":999000}'
    );
  });
});
