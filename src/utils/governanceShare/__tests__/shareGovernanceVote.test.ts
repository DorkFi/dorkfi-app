import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildXIntentUrl,
  getGovernanceShareHelperText,
  getShareOutcomeMessage,
  shareGovernanceVote,
  supportsNativeFileShare,
} from "../shareGovernanceVote";

vi.mock("@/services/xShareService", () => ({
  isXShareApiConfigured: vi.fn(() => false),
  getShareServerHealth: vi.fn(),
  getXShareStatus: vi.fn(),
  postGovernanceVoteToX: vi.fn(),
  createGovernanceShareLink: vi.fn(),
}));

import {
  createGovernanceShareLink,
  getShareServerHealth,
  getXShareStatus,
  isXShareApiConfigured,
  postGovernanceVoteToX,
} from "@/services/xShareService";

const shareOptions = {
  proposalId: "prop-1",
  proposalTitle: "Test Proposal",
  support: true,
  votingPower: 1000,
};

describe("buildXIntentUrl", () => {
  it("uses x.com intent with encoded text", () => {
    expect(buildXIntentUrl("Hello @Dork_Fi")).toBe(
      "https://x.com/intent/tweet?text=Hello%20%40Dork_Fi"
    );
  });
});

describe("getGovernanceShareHelperText", () => {
  it("describes native share on mobile-capable browsers", () => {
    expect(getGovernanceShareHelperText(true)).toContain("share menu");
  });

  it("describes paste flow on desktop", () => {
    expect(getGovernanceShareHelperText(false)).toContain("⌘V or Ctrl+V");
  });
});

describe("getShareOutcomeMessage", () => {
  it("includes paste instructions for clipboard outcome", () => {
    expect(getShareOutcomeMessage("clipboard").description).toContain("⌘V or Ctrl+V");
  });

  it("describes api outcome with tweet url", () => {
    expect(
      getShareOutcomeMessage("api", "https://x.com/dork_fi/status/1").description
    ).toContain("image attached");
  });

  it("describes link outcome", () => {
    expect(getShareOutcomeMessage("link").description).toContain("preview");
  });
});

describe("supportsNativeFileShare", () => {
  it("returns false when canShare is unavailable", () => {
    const file = new File([new Uint8Array([1])], "test.png", {
      type: "image/png",
    });
    expect(supportsNativeFileShare(file)).toBe(false);
  });
});

describe("shareGovernanceVote", () => {
  const blob = new Blob([new Uint8Array([137, 80, 78, 71])], {
    type: "image/png",
  });
  const result = { blob, objectUrl: "blob:mock" };

  const openMock = vi.fn();

  beforeEach(() => {
    vi.mocked(isXShareApiConfigured).mockReturnValue(false);
    vi.mocked(getShareServerHealth).mockResolvedValue({
      ok: false,
      linkShareEnabled: false,
    });
    vi.mocked(getXShareStatus).mockReset();
    vi.mocked(postGovernanceVoteToX).mockReset();
    vi.mocked(createGovernanceShareLink).mockReset();
    vi.stubGlobal("window", {
      open: openMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    openMock.mockReset();
  });

  it("uses native share when file sharing is supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      share,
      canShare: vi.fn().mockReturnValue(true),
    });

    const shareResult = await shareGovernanceVote(result, {
      ...shareOptions,
      text: "Vote tweet",
    });

    expect(shareResult.outcome).toBe("native");
    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
    expect(openMock).not.toHaveBeenCalled();
  });

  it("opens X compose with share link when link share succeeds", async () => {
    vi.mocked(isXShareApiConfigured).mockReturnValue(true);
    vi.mocked(getShareServerHealth).mockResolvedValue({
      ok: true,
      linkShareEnabled: true,
    });
    vi.mocked(getXShareStatus).mockResolvedValue({
      connected: false,
      configured: false,
      linkShareEnabled: true,
    });
    vi.mocked(createGovernanceShareLink).mockResolvedValue({
      shareId: "abc",
      shareUrl: "https://share.dork.fi/gov/abc",
      imageUrl: "https://share.dork.fi/gov/abc/image.png",
    });
    vi.stubGlobal("navigator", {
      canShare: undefined,
    });

    const shareResult = await shareGovernanceVote(result, shareOptions);

    expect(shareResult.outcome).toBe("link");
    expect(shareResult.shareUrl).toBe("https://share.dork.fi/gov/abc");
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("https://share.dork.fi/gov/abc")),
      "_blank",
      "noopener,noreferrer"
    );
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("Test Proposal")),
      "_blank",
      "noopener,noreferrer"
    );
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("Would you vote the same?")),
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("posts via API when connected", async () => {
    vi.mocked(isXShareApiConfigured).mockReturnValue(true);
    vi.mocked(getXShareStatus).mockResolvedValue({
      connected: true,
      configured: true,
      username: "@dork_fi",
    });
    vi.mocked(postGovernanceVoteToX).mockResolvedValue({
      tweetId: "1",
      tweetUrl: "https://x.com/dork_fi/status/1",
    });
    vi.stubGlobal("navigator", {
      canShare: undefined,
    });

    const shareResult = await shareGovernanceVote(result, {
      ...shareOptions,
      text: "Vote tweet",
    });

    expect(shareResult.outcome).toBe("api");
    expect(postGovernanceVoteToX).toHaveBeenCalled();
    expect(createGovernanceShareLink).not.toHaveBeenCalled();
  });

  it("falls back to clipboard and opens X compose on desktop", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      canShare: undefined,
      clipboard: { write },
    });
    vi.stubGlobal("ClipboardItem", class ClipboardItem {});

    const shareResult = await shareGovernanceVote(result, {
      ...shareOptions,
      text: "Vote tweet",
    });

    expect(shareResult.outcome).toBe("clipboard");
    expect(write).toHaveBeenCalled();
    expect(openMock).toHaveBeenCalledWith(
      "https://x.com/intent/tweet?text=Vote%20tweet",
      "_blank",
      "noopener,noreferrer"
    );
  });
});
