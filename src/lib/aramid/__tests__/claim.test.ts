import { describe, expect, it } from "vitest";
import { matchAramidConfirmTx } from "@/lib/aramid/claim";

describe("matchAramidConfirmTx", () => {
  it("returns the payout whose note names the source transaction", () => {
    const source = "IQHD7ATFJSMVFTPR4X26O3X5ZOQR2CGC5U4BAGZ47QGCSHDDA6RA";
    const note = `aramid-confirm/v1:j${JSON.stringify({
      sourceTxId: source,
      sourceNetwork: 416001,
      note: "dorkfi",
    })}`;
    expect(
      matchAramidConfirmTx(
        [
          { id: "OTHER", note: "aramid-confirm/v1:j{}" },
          { id: "VOIPAYOUT", note },
        ],
        source
      )
    ).toBe("VOIPAYOUT");
  });
});
