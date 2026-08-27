import { describe, expect, it } from "vitest";
import {
  buildGovernanceVoteIntentUrl,
  buildGovernanceVoteShareText,
  formatGovernanceShareTimeLeft,
  governanceVoteShareUrl,
} from "../format";

const now = new Date("2026-08-27T17:00:00.000Z");

describe("formatGovernanceShareTimeLeft", () => {
  it("uses hours when less than one day remains", () => {
    const endTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    expect(formatGovernanceShareTimeLeft(endTime, now)).toBe("5 hours");
  });

  it("uses the singular hour", () => {
    const endTime = new Date(now.getTime() + 60 * 60 * 1000);
    expect(formatGovernanceShareTimeLeft(endTime, now)).toBe("1 hour");
  });

  it("uses days when at least one day remains", () => {
    const endTime = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(formatGovernanceShareTimeLeft(endTime, now)).toBe("3 days");
  });

  it("returns null when voting has ended", () => {
    const endTime = new Date(now.getTime() - 1000);
    expect(formatGovernanceShareTimeLeft(endTime, now)).toBeNull();
  });
});

describe("buildGovernanceVoteShareText", () => {
  it("adds a passing status line when yes share is above 50%", () => {
    expect(
      buildGovernanceVoteShareText({
        support: true,
        proposalTitle: "List WAD",
        endTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        votesFor: 62,
        votesAgainst: 38,
        now,
      })
    ).toBe(
      'Voted YES on "List WAD" in @dork_fi governance 🗳️\n\nThis proposal has 3 days left, and is currently passing with 62% of the vote.'
    );
  });

  it("adds a failing status line with hours when under one day remains", () => {
    expect(
      buildGovernanceVoteShareText({
        support: false,
        proposalTitle: "List WAD",
        endTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
        votesFor: 41,
        votesAgainst: 59,
        now,
      })
    ).toBe(
      'Voted NO on "List WAD" in @dork_fi governance 🗳️\n\nThis proposal has 5 hours left, and is currently failing with 41% of the vote.'
    );
  });

  it("treats 50% as failing", () => {
    const text = buildGovernanceVoteShareText({
      support: true,
      proposalTitle: "List WAD",
      endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      votesFor: 50,
      votesAgainst: 50,
      now,
    });
    expect(text).toContain("failing with 50% of the vote");
  });

  it("truncates long titles", () => {
    const title = "A".repeat(120);
    const text = buildGovernanceVoteShareText({
      support: true,
      proposalTitle: title,
      endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      votesFor: 80,
      votesAgainst: 20,
      now,
    });
    expect(text).toContain(`"${"A".repeat(97)}..."`);
  });
});

describe("governanceVoteShareUrl", () => {
  it("uses an app.dork.fi governance permalink", () => {
    expect(governanceVoteShareUrl()).toBe(
      "https://app.dork.fi/governance/share.html"
    );
  });
});

describe("buildGovernanceVoteIntentUrl", () => {
  it("keeps the tweet text and swaps in the share permalink", () => {
    const text = 'Voted YES on "List WAD" in @dork_fi governance 🗳️';
    const shareUrl = "https://app.dork.fi/governance/share.html";
    expect(buildGovernanceVoteIntentUrl(text, shareUrl)).toBe(
      `https://x.com/intent/tweet?text=${encodeURIComponent(
        text
      )}&url=${encodeURIComponent(shareUrl)}`
    );
  });
});
