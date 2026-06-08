import { describe, it, expect } from "vitest";
import {
  buildGenericGovernanceShareTweetText,
  buildGovernanceShareTweetText,
  computeShareTextBlockHeight,
  computeShareTextTopY,
  formatVoteHeadline,
  formatVoteHeadlineVote,
  formatVotingPowerLabel,
  resolveAnchoredTextTopY,
  resolveShareTitleLayout,
  resolveTitleFontSize,
  splitProposalTitleLines,
  truncateLineToWidth,
  wrapTextLines,
  SHARE_TITLE_LINE_HEIGHT_MULTIPLIER,
} from "../format";
import {
  GOVERNANCE_SHARE_TEMPLATE_NO_PATH,
  GOVERNANCE_SHARE_TEMPLATE_YES_PATH,
  resolveGovernanceShareTemplatePath,
} from "../types";

describe("resolveGovernanceShareTemplatePath", () => {
  it("returns yes template for support true", () => {
    expect(resolveGovernanceShareTemplatePath(true)).toBe(
      GOVERNANCE_SHARE_TEMPLATE_YES_PATH
    );
  });

  it("returns no template for support false", () => {
    expect(resolveGovernanceShareTemplatePath(false)).toBe(
      GOVERNANCE_SHARE_TEMPLATE_NO_PATH
    );
  });
});

describe("formatVoteHeadline", () => {
  it("returns I VOTED YES when support is true", () => {
    expect(formatVoteHeadline(true)).toBe("I VOTED YES");
  });

  it("returns I VOTED NO when support is false", () => {
    expect(formatVoteHeadline(false)).toBe("I VOTED NO");
  });
});

describe("formatVoteHeadlineVote", () => {
  it("returns YES or NO based on support", () => {
    expect(formatVoteHeadlineVote(true)).toBe("YES");
    expect(formatVoteHeadlineVote(false)).toBe("NO");
  });
});

describe("splitProposalTitleLines", () => {
  it("splits three-word titles at the midpoint", () => {
    expect(splitProposalTitleLines("Increasing $HAY Supply")).toEqual([
      "INCREASING",
      "$HAY SUPPLY",
    ]);
  });

  it("uses one line per word for two-word titles", () => {
    expect(splitProposalTitleLines("Add USDC")).toEqual(["ADD", "USDC"]);
  });

  it("returns a single line for one-word titles", () => {
    expect(splitProposalTitleLines("Treasury")).toEqual(["TREASURY"]);
  });

  it("uses fallback when title is empty", () => {
    expect(splitProposalTitleLines("   ")).toEqual(["GOVERNANCE", "PROPOSAL"]);
  });
});

describe("formatVotingPowerLabel", () => {
  it("formats voting power with locale grouping", () => {
    expect(formatVotingPowerLabel(69)).toBe("69 $UNIT VOTING POWER");
    expect(formatVotingPowerLabel(12345)).toBe("12,345 $UNIT VOTING POWER");
    expect(formatVotingPowerLabel(69420)).toBe("69,420 $UNIT VOTING POWER");
  });
});

describe("buildGovernanceShareTweetText", () => {
  it("builds a YES vote tweet with engagement hook and default link", () => {
    expect(
      buildGovernanceShareTweetText({
        support: true,
        proposalTitle: "Increasing $HAY Supply",
        votingPower: 69420,
      })
    ).toBe(
      [
        'I voted YES on "Increasing $HAY Supply" with 69,420 $UNIT in @Dork_Fi governance.',
        "",
        "Would you vote the same? 👇",
        "https://app.dork.fi/governance",
        "",
        "#DorkFi",
      ].join("\n")
    );
  });

  it("builds a punchy NO vote tweet", () => {
    expect(
      buildGovernanceShareTweetText({
        support: false,
        proposalTitle: "Treasury Diversification",
        votingPower: 12345,
      })
    ).toBe(
      [
        "I VOTED NO on Treasury Diversification — 12,345 $UNIT says not yet.",
        "",
        "Would you vote the same? 👇",
        "https://app.dork.fi/governance",
        "",
        "#DorkFi",
      ].join("\n")
    );
  });

  it("uses a custom share URL when provided", () => {
    expect(
      buildGovernanceShareTweetText({
        support: true,
        proposalTitle: "Add USDC Pool",
        votingPower: 5000,
        shareUrl: "https://share.dork.fi/gov/abc",
      })
    ).toContain("https://share.dork.fi/gov/abc");
  });
});

describe("buildGenericGovernanceShareTweetText", () => {
  it("falls back to generic engagement copy when vote metadata is unavailable", () => {
    expect(buildGenericGovernanceShareTweetText()).toBe(
      [
        "I just voted in @Dork_Fi governance.",
        "",
        "Would you vote the same? 👇",
        "https://app.dork.fi/governance",
        "",
        "#DorkFi",
      ].join("\n")
    );
  });
});

describe("truncateLineToWidth", () => {
  const measure = (text: string) => text.length * 10;

  it("returns text unchanged when it fits", () => {
    expect(truncateLineToWidth("Short", measure, 100)).toBe("Short");
  });

  it("truncates with ellipsis when text overflows", () => {
    const result = truncateLineToWidth("A very long proposal title", measure, 120);
    expect(result.endsWith("...")).toBe(true);
    expect(measure(result)).toBeLessThanOrEqual(120);
  });
});

describe("wrapTextLines", () => {
  const measure = (text: string) => text.length * 10;

  it("returns a single line for short text", () => {
    expect(wrapTextLines("Add USDC Pool", measure, 200, 3)).toEqual([
      "Add USDC Pool",
    ]);
  });

  it("wraps words across multiple lines", () => {
    const lines = wrapTextLines(
      "Increase WAD Borrow Cap for treasury",
      measure,
      180,
      3
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toContain("Increase");
    expect(lines.join(" ")).toContain("treasury");
  });

  it("ellipsizes when exceeding max lines", () => {
    const longTitle =
      "Treasury Diversification Proposal With Additional Strategic Allocation Details";
    const lines = wrapTextLines(longTitle, measure, 120, 2, true);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/\.\.\.$/);
  });

  it("wraps all content without ellipsis when disabled", () => {
    const longTitle =
      "Treasury Diversification Proposal With Additional Strategic Allocation Details";
    const lines = wrapTextLines(longTitle, measure, 120, 2, false);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.every((line) => !line.endsWith("..."))).toBe(true);
    expect(lines.join("").replace(/\s/g, "")).toBe(longTitle.replace(/\s/g, ""));
  });

  it("handles empty title", () => {
    expect(wrapTextLines("   ", measure, 200, 3)).toEqual([""]);
  });
});

describe("resolveTitleFontSize", () => {
  const measureAtSize = (text: string, fontSize: number) =>
    text.length * fontSize;

  it("uses max font size when lines fit", () => {
    const result = resolveTitleFontSize(
      ["INCREASING", "$HAY SUPPLY"],
      measureAtSize,
      1000,
      56,
      80
    );
    expect(result.fontSize).toBe(80);
    expect(result.lines).toEqual(["INCREASING", "$HAY SUPPLY"]);
  });

  it("steps down font size when lines overflow", () => {
    const result = resolveTitleFontSize(
      ["INCREASING", "$HAY SUPPLY"],
      measureAtSize,
      600,
      56,
      80
    );
    expect(result.fontSize).toBeLessThan(80);
    expect(result.lines.every((line) => measureAtSize(line, result.fontSize) <= 600)).toBe(
      true
    );
  });

  it("never ellipsizes lines at minimum font size", () => {
    const result = resolveTitleFontSize(
      ["A VERY LONG PROPOSAL TITLE THAT WILL NOT FIT"],
      measureAtSize,
      100,
      56,
      80
    );
    expect(result.lines[0]).not.toMatch(/\.\.\.$/);
    expect(result.lines[0]).toBe("A VERY LONG PROPOSAL TITLE THAT WILL NOT FIT");
  });
});

describe("resolveShareTitleLayout", () => {
  const measureAtSize = (text: string, fontSize: number) =>
    text.length * fontSize;

  it("wraps long titles to two lines without ellipsis", () => {
    const title = "Increasing $HAY Supply for treasury operations";
    const result = resolveShareTitleLayout(
      title,
      measureAtSize,
      500,
      400,
      18,
      28,
      80,
      2
    );
    expect(result.lines.length).toBeLessThanOrEqual(2);
    expect(result.lines.join("").replace(/\s/g, "")).toBe(
      title.toUpperCase().replace(/\s/g, "")
    );
    expect(result.lines.every((line) => !line.endsWith("..."))).toBe(true);
  });

  it("splits four-word titles across two balanced lines", () => {
    const result = resolveShareTitleLayout(
      "Increase $HAY Supply Cap",
      measureAtSize,
      1000,
      400,
      18,
      28,
      80,
      2
    );
    expect(result.lines).toEqual(["INCREASE $HAY", "SUPPLY CAP"]);
  });

  it("shrinks font size to fit width and height", () => {
    const title =
      "Treasury Diversification Proposal With Additional Strategic Allocation Details";
    const result = resolveShareTitleLayout(
      title,
      measureAtSize,
      300,
      200,
      18,
      28,
      80,
      2
    );
    expect(result.fontSize).toBeLessThan(80);
    expect(result.lines.length).toBeLessThanOrEqual(2);
    expect(result.lines.every((line) => !line.endsWith("..."))).toBe(true);
    expect(result.lines.join("").replace(/\s/g, "")).toBe(
      title.toUpperCase().replace(/\s/g, "")
    );
  });
});

describe("resolveAnchoredTextTopY", () => {
  it("uses anchor when block fits above logo zone", () => {
    expect(resolveAnchoredTextTopY(108, 300, 510)).toBe(108);
  });

  it("shifts up when block would overlap logo zone", () => {
    expect(resolveAnchoredTextTopY(108, 450, 510)).toBe(60);
  });
});

describe("computeShareTextTopY", () => {
  it("centers block vertically with bias", () => {
    const top = computeShareTextTopY(300, 675, 560, 64, -20);
    expect(top).toBeGreaterThanOrEqual(64);
    expect(top + 300).toBeLessThanOrEqual(560);
  });

  it("shifts up when block would overlap logo zone", () => {
    const top = computeShareTextTopY(520, 675, 560, 64, 0);
    expect(top + 520).toBeLessThanOrEqual(560);
    expect(top).toBe(40);
  });
});

describe("computeShareTextBlockHeight", () => {
  it("accounts for paired title lines and gaps", () => {
    const height = computeShareTextBlockHeight({
      headlineFontSize: 48,
      gapHeadlineToTitle: 50,
      titleFontSize: 72,
      titleLineCount: 2,
      gapBetweenTitleLines: 18,
      gapTitleToPower: 50,
      powerFontSize: 28,
    });
    expect(height).toBe(
      48 +
        50 +
        72 * SHARE_TITLE_LINE_HEIGHT_MULTIPLIER * 2 +
        18 +
        50 +
        28
    );
  });
});
