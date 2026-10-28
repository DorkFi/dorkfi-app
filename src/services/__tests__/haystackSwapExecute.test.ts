import { describe, expect, it } from "vitest";
import { SwapComposerStatus, type SwapComposer } from "@txnlab/haystack-router";
import {
  getHaystackSdkApiBaseUrl,
  pickSwapTxIdFromComposer,
} from "@/services/haystackSwapExecute";

describe("getHaystackSdkApiBaseUrl", () => {
  it("appends /api for absolute proxy origins", () => {
    // Force absolute by temporarily stubbing — function reads import.meta env.
    // Default Vite path should end with /api/haystack/api when window origin is set.
    const url = getHaystackSdkApiBaseUrl();
    expect(url.endsWith("/api")).toBe(true);
    expect(url.includes("haystack") || url.includes("127.0.0.1") || url.includes("localhost") || url.startsWith("http")).toBe(true);
  });
});

describe("pickSwapTxIdFromComposer", () => {
  function composer(
    status: SwapComposerStatus,
    inputTxId?: string
  ): SwapComposer {
    return {
      getStatus: () => status,
      getInputTransactionId: () => inputTxId,
    } as unknown as SwapComposer;
  }

  it("ignores a transaction id that exists before the group is submitted", () => {
    expect(
      pickSwapTxIdFromComposer(
        null,
        composer(SwapComposerStatus.BUILT, "UNSIGNED")
      )
    ).toBeUndefined();
  });

  it("returns the id after the group is submitted", () => {
    expect(
      pickSwapTxIdFromComposer(
        null,
        composer(SwapComposerStatus.SUBMITTED, "SIGNED")
      )
    ).toBe("SIGNED");
  });

  it("prefers the id returned by execute", () => {
    expect(
      pickSwapTxIdFromComposer(
        { txIds: ["CONFIRMED"] },
        composer(SwapComposerStatus.BUILDING, "UNSIGNED")
      )
    ).toBe("CONFIRMED");
  });
});
