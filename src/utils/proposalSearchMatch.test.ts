import { describe, expect, it } from "vitest";
import type { Proposal } from "@/types/governanceTypes";
import { proposalMatchesSearch } from "./proposalSearchMatch";

const sample: Proposal = {
  id: "prop-42",
  title: "Treasury allocation Q1",
  description: "Fund the community pool",
  category: "treasury",
  proposer: "ALGO7DUMMYADDRESS",
  status: "active",
  votesFor: 0,
  votesAgainst: 0,
  totalVotes: 0,
  quorum: 1,
  startTime: new Date("2025-01-01"),
  endTime: new Date("2026-01-01"),
  details: { type: "treasury", recipient: "r", amount: 1, asset: "a", purpose: "p" },
};

describe("proposalMatchesSearch", () => {
  it("matches when query is empty or whitespace", () => {
    expect(proposalMatchesSearch(sample, "")).toBe(true);
    expect(proposalMatchesSearch(sample, "   ")).toBe(true);
  });

  it("matches title and id case-insensitively", () => {
    expect(proposalMatchesSearch(sample, "treasury allocation")).toBe(true);
    expect(proposalMatchesSearch(sample, "PROP-42")).toBe(true);
  });

  it("matches proposer substring", () => {
    expect(proposalMatchesSearch(sample, "dummyaddress")).toBe(true);
  });

  it("matches category display name", () => {
    expect(proposalMatchesSearch(sample, "treasury")).toBe(true);
  });

  it("returns false when no field contains the query", () => {
    expect(proposalMatchesSearch(sample, "zzzz-not-found")).toBe(false);
  });
});
