import { describe, expect, it } from "vitest";
import {
  assertSponsorReady,
  isSponsorFullyFunded,
  isSponsorLegFunded,
  SponsorFundingError,
  type SponsorLeg,
  type SponsorResult,
} from "@/lib/easyStart/sponsorApi";

const funded: SponsorLeg = { status: "sent", txHash: "tx" };
const already: SponsorLeg = { status: "skipped", reason: "already_funded" };
const disabled: SponsorLeg = { status: "skipped", reason: "disabled" };
const failed: SponsorLeg = { status: "error", error: "Could not send ALGO" };

function result(eth: SponsorLeg, algo: SponsorLeg): SponsorResult {
  return {
    evmAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    algorandAddress: "ALGO1",
    eth,
    algo,
  };
}

describe("isSponsorLegFunded", () => {
  it("treats sent and already_funded as complete", () => {
    expect(isSponsorLegFunded(funded)).toBe(true);
    expect(isSponsorLegFunded(already)).toBe(true);
    expect(isSponsorLegFunded(disabled)).toBe(false);
    expect(isSponsorLegFunded(failed)).toBe(false);
  });
});

describe("isSponsorFullyFunded", () => {
  it("requires both legs to have landed or already been funded", () => {
    expect(isSponsorFullyFunded(result(funded, already))).toBe(true);
    expect(isSponsorFullyFunded(result(funded, failed))).toBe(false);
    expect(isSponsorFullyFunded(result(disabled, already))).toBe(false);
  });
});

describe("assertSponsorReady", () => {
  it("returns the result when no leg failed", () => {
    const ok = result(funded, disabled);
    expect(assertSponsorReady(ok)).toBe(ok);
  });

  it("throws when the ALGO treasury send failed", () => {
    expect(() => assertSponsorReady(result(funded, failed))).toThrow(
      SponsorFundingError
    );
    try {
      assertSponsorReady(result(funded, failed));
    } catch (error) {
      expect(error).toBeInstanceOf(SponsorFundingError);
      expect((error as Error).message).toMatch(/Algorand/);
      expect((error as Error).message.toLowerCase()).not.toMatch(/fee|gas/);
    }
  });
});
