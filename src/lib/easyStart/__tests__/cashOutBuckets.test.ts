import { describe, expect, it } from "vitest";
import {
  cashOutEmptyBucket,
  cashOutEmptyDescription,
} from "@/lib/easyStart/cashOutBuckets";

describe("cashOutEmptyBucket", () => {
  it("does not invent an empty state when Base can be cashed out", () => {
    expect(
      cashOutEmptyBucket({ baseUsd: 12, earnUsd: 40, algorandUsd: 8 })
    ).toBeNull();
  });

  it("names Earn when Base is empty and Earn still holds funds", () => {
    expect(
      cashOutEmptyBucket({ baseUsd: 0, earnUsd: 25, algorandUsd: 0 })
    ).toBe("earn");
  });

  it("names Algorand when the money already left Earn", () => {
    expect(
      cashOutEmptyBucket({ baseUsd: 0.004, earnUsd: 0, algorandUsd: 40 })
    ).toBe("algorand");
  });

  it("treats dust on every chain as nothing to cash out", () => {
    expect(
      cashOutEmptyBucket({ baseUsd: 0.01, earnUsd: 0.01, algorandUsd: 0.01 })
    ).toBe("empty");
  });
});

describe("cashOutEmptyDescription", () => {
  it("tells consumer users to move Algorand funds before cashing out", () => {
    expect(
      cashOutEmptyDescription({
        consumerCopy: true,
        baseUsd: 0,
        earnUsd: 0,
        algorandUsd: 18,
      })
    ).toBe("This balance is on Algorand. Move it to your account first.");
  });

  it("does not say withdraw from Earn after the funds have left", () => {
    const message = cashOutEmptyDescription({
      consumerCopy: true,
      baseUsd: 0,
      earnUsd: 0,
      algorandUsd: 18,
    });
    expect(message).not.toMatch(/Earn/i);
  });

  it("says nothing to cash out when every bucket is empty", () => {
    expect(
      cashOutEmptyDescription({
        consumerCopy: true,
        baseUsd: 0,
        earnUsd: 0,
        algorandUsd: 0,
      })
    ).toBe("Nothing to cash out.");
  });
});
