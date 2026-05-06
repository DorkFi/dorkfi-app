import { describe, expect, it } from "vitest";
import {
  apiRecordToProposal,
  deriveClosedStatusFromVoteCounts,
  normalizeApiProposalCategory,
} from "./apiProposalToProposal";

describe("normalizeApiProposalCategory", () => {
  it("maps contract category id", () => {
    expect(normalizeApiProposalCategory({ categoryId: 4 })).toBe("treasury");
    expect(normalizeApiProposalCategory({ proposalCategoryId: "2" })).toBe(
      "collateral-listing"
    );
  });

  it("maps slug strings", () => {
    expect(
      normalizeApiProposalCategory({ category: "collateral-listing" })
    ).toBe("collateral-listing");
    expect(
      normalizeApiProposalCategory({ category: "collateral_listing" })
    ).toBe("collateral-listing");
  });

  it("maps display labels from API", () => {
    expect(normalizeApiProposalCategory({ category: "Treasury" })).toBe(
      "treasury"
    );
    expect(
      normalizeApiProposalCategory({ category: "Collateral Listing" })
    ).toBe("collateral-listing");
  });

  it("reads nested category object", () => {
    expect(
      normalizeApiProposalCategory({
        category: { slug: "infrastructure" },
      })
    ).toBe("infrastructure");
  });
});

describe("deriveClosedStatusFromVoteCounts (69% yes of cast)", () => {
  const ended = new Date(Date.now() - 86_400_000);

  it("fails below 69% yes share", () => {
    expect(
      deriveClosedStatusFromVoteCounts("active", ended, 30, 70, 0)
    ).toBe("rejected");
    expect(
      deriveClosedStatusFromVoteCounts("passed", ended, 30, 70, 0)
    ).toBe("rejected");
  });

  it("passes at or above 69% yes share", () => {
    expect(
      deriveClosedStatusFromVoteCounts("active", ended, 70, 30, 0)
    ).toBe("passed");
    expect(
      deriveClosedStatusFromVoteCounts("active", ended, 690, 310, 0)
    ).toBe("passed");
  });

  it("includes abstain in denominator", () => {
    expect(
      deriveClosedStatusFromVoteCounts("active", ended, 68, 20, 11)
    ).toBe("rejected");
    expect(
      deriveClosedStatusFromVoteCounts("active", ended, 69, 10, 10)
    ).toBe("passed");
  });

  it("leaves executed unchanged", () => {
    expect(
      deriveClosedStatusFromVoteCounts("executed", ended, 1, 99, 0)
    ).toBe("executed");
  });

  it("uses total power denominator when larger than for+against+abstain", () => {
    expect(
      deriveClosedStatusFromVoteCounts("active", ended, 60, 40, 0, 200)
    ).toBe("rejected");
    expect(
      deriveClosedStatusFromVoteCounts("active", ended, 60, 40, 0, 100)
    ).toBe("rejected");
    expect(
      deriveClosedStatusFromVoteCounts("active", ended, 70, 30, 0, 100)
    ).toBe("passed");
  });
});

describe("apiRecordToProposal pass threshold", () => {
  it("applies 69% to count-only rows after end", () => {
    const endedIso = new Date(Date.now() - 86_400_000).toISOString();
    const rejected = apiRecordToProposal({
      status: "active",
      votingEnd: endedIso,
      votesFor: 300,
      votesAgainst: 700,
    });
    expect(rejected.status).toBe("rejected");

    const passed = apiRecordToProposal({
      status: "active",
      votingEnd: endedIso,
      votesFor: 700,
      votesAgainst: 300,
    });
    expect(passed.status).toBe("passed");
  });

  it("reconciles API passed when power tally is under 69%", () => {
    const endedIso = new Date(Date.now() - 86_400_000).toISOString();
    const p = apiRecordToProposal({
      status: "passed",
      votingEnd: endedIso,
      proposalTotalPower: 100 * 1e8,
      proposalYesPower: 30 * 1e8,
    });
    expect(p.status).toBe("rejected");
    expect(p.usesVotingPowerTally).toBe(true);
  });
});
